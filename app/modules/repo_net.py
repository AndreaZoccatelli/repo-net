from pyvis.network import Network
from collections import Counter
from .utils import (
    get_paths,
    walk_with_exclusions,
    format_file,
    load_network_options,
    load_html_template,
)
import numpy as np
import os
import re


class RepoNet:
    def __init__(self, exclude_dirs: np.ndarray = np.array([".git", "venv", ".venv"])):
        self.repo_path, self.output_path = get_paths()
        self.exclude_dirs = exclude_dirs

    def build_dependency_map(self):
        self.dependencies_map = {}
        self.paths_map = {}
        self.project_files = np.array([])
        remove_extension = np.vectorize(lambda x: "".join(x.split(".")[:-1]))

        for root, _, files in walk_with_exclusions(self.repo_path, self.exclude_dirs):
            if len(files) > 0:
                files = files[
                    np.char.endswith(files, ".py") | np.char.endswith(files, ".ipynb")
                ]  # Filter Python files
            if len(files) > 0:
                file_names = remove_extension(files)
                self.project_files = np.append(self.project_files, files)
                self.project_files = np.append(self.project_files, file_names)

            for f in files:
                file_path = os.path.join(root, f)
                script = format_file(f, file_path)

                dependencies = np.array(
                    re.findall(r"^(?:import|from) (?!\.)\b(\S+)", script, re.MULTILINE)
                )
                self.dependencies_map[f] = np.append(
                    self.dependencies_map.get(f, np.array([])), dependencies
                )
                self.paths_map[f] = file_path

        dependents = np.array([])
        for key, val in self.dependencies_map.items():
            if len(val) > 0:
                self.dependencies_map[key] = np.unique(val)
            dependents = np.append(dependents, self.dependencies_map[key])
        self.dependents_map = Counter(dependents)

    def build_dependency_graph(
        self,
        height="600px",
        width="100%",
    ):
        net = Network(
            height=height,
            width=width,
            directed=True,
            select_menu=False,
            filter_menu=False,
            cdn_resources="remote",
            bgcolor="#0A192F",
        )
        network_options, color_palette = load_network_options()
        net.set_options(network_options)

        max_dependencies = 0
        if len(self.dependents_map) > 0:
            max_dependents = max(self.dependents_map.values())
        else:
            max_dependents = 0

        for module, dependencies in self.dependencies_map.items():
            if module in self.project_files:
                category = "internal"
                colors = color_palette["internal"]
            else:
                category = "external"
                colors = color_palette["external"]

            n_dependencies = len(dependencies)
            if module not in self.dependents_map:
                n_dependents = 0
            else:
                n_dependents = self.dependents_map[module]
            max_dependencies = max(max_dependencies, n_dependencies)
            base_size = 20
            size_factor = 3
            node_size = base_size + (n_dependencies * size_factor)

            net.add_node(
                module,
                label=module,
                title=f"Module: {module}\nDependencies: {n_dependencies}\nDependents: {n_dependents}\nType: {category.capitalize()}",
                color={
                    "background": colors["primary"],
                    "border": colors["border"],
                    "highlight": {
                        "background": colors["highlight"],
                        "border": colors["border"],
                    },
                    "hover": {
                        "background": colors["highlight"],
                        "border": colors["border"],
                    },
                },
                size=node_size,
                borderWidth=2,
                borderWidthSelected=3,
                category=category,
                dependencies=n_dependencies,
                dependents=n_dependents,
                file_path=self.paths_map[module],
            )

            for dep in dependencies:
                if dep not in [node["id"] for node in net.nodes]:
                    dep_colors = (
                        color_palette["internal"]
                        if dep in self.project_files
                        else color_palette["external"]
                    )
                    if dep not in self.dependents_map:
                        n_dependents = 0
                    else:
                        n_dependents = self.dependents_map[dep]
                    net.add_node(
                        dep,
                        label=dep,
                        title=f"Module: {dep}\nDependents: {n_dependents}\nType: {'Internal' if dep in self.project_files else 'External'}",
                        color={
                            "background": dep_colors["primary"],
                            "border": dep_colors["border"],
                            "highlight": {
                                "background": dep_colors["highlight"],
                                "border": dep_colors["border"],
                            },
                            "hover": {
                                "background": dep_colors["highlight"],
                                "border": dep_colors["border"],
                            },
                        },
                        size=base_size,
                        borderWidth=2,
                        borderWidthSelected=3,
                        category=(
                            "internal" if dep in self.project_files else "external"
                        ),
                        dependents=n_dependents,
                    )
                net.add_edge(module, dep)

        # Updated HTML template with fixed filtering functionality
        head_template = load_html_template("head_template.html")
        body_template = load_html_template(
            "body_template.html", max_dependencies, max_dependents
        )

        html = net.generate_html()
        html = html.replace("<head>", head_template)
        html = html.replace("<body>", body_template)
        html = html.replace(
            """<div class="card" style="width: 100%">
            
            
            <div id="mynetwork" class="card-body"></div>
        </div>""",
            "",
        )
        with open(self.output_path, "w", encoding="utf-8") as f:
            f.write(html)
