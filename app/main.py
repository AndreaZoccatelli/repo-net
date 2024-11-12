from modules.repo_net import RepoNet


if __name__ == "__main__":
    network = RepoNet()
    network.build_dependency_map()
    network.build_dependency_graph()