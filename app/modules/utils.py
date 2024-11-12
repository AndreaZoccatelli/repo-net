import os
import numpy as np
import json
import argparse

def get_paths():
    parser = argparse.ArgumentParser(description="Generate Dependency Graph.")
    parser.add_argument("repo_path", type=str, help="Path to the repository")
    parser.add_argument(
        "output_path", type=str, help="Path to save the generated graph"
    )
    args = parser.parse_args()
    return args.repo_path, args.output_path


def walk_with_exclusions(dir_path: str, exclude_dirs: set):
    for root, dirs, files in os.walk(dir_path):
        # Modify `dirs` in place to exclude specific directories
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        # Now `os.walk` will skip the directories in `exclude_dirs`
        yield root, dirs, np.array(files)


def format_file(file_name: str, file_path: str):
    if file_name.endswith(".ipynb"):
        with open(file_path, "r", encoding="utf-8") as file:
            notebook = json.load(file)

        code_cells = [
            cell["source"] for cell in notebook["cells"] if cell["cell_type"] == "code"
        ]
        script = "\n".join("".join(cell) for cell in code_cells)
    elif file_name.endswith(".py"):

        with open(file_path, "r", encoding="utf-8") as file:
            script = file.read()

    return script


def load_html_template(file_name: str, max_dependencies: int=None, max_dependents: int=None):
    template_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'templates', 'page_template')
    with open(os.path.join(template_dir, file_name), "r") as file:
        html_template = file.read()
    
    if max_dependencies is not None:
        html_template = html_template.replace("{max_dependencies}", str(max_dependencies))
        html_template = html_template.replace("{max_dependents}", str(max_dependents))
    return html_template


def load_network_options():
    template_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'templates', 'network_template')
    with open(os.path.join(template_dir, 'network_options.json'), "r") as file:
        network_options = file.read()
    with open(os.path.join(template_dir, 'network_color_palette.json'), "r") as file:
        color_palette = json.load(file)
    return network_options, color_palette
