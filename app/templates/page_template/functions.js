let networkInstance = null;


// Update the dependency value display as the slider is moved
document.getElementById('dependenciesFilter').addEventListener('input', function() {
    const depValue = this.value;
    document.getElementById('dependencyValue').innerHTML = depValue;
});


document.getElementById('dependentsFilter').addEventListener('input', function() {
    const depValue = this.value;
    document.getElementById('dependentsValue').innerHTML = depValue;
});


// Initialize filter functionality
let lastDependenciesFilter = 0;
let lastDependentsFilter = 0;
let lastCategoryFilter = "";
let lastNodeSelection = [];


window.addEventListener('load', function() {
    // Initialize the filters after the window load
    initializeFilters();
});

const vscode = acquireVsCodeApi();

function openFile(filePath) {
    if (!filePath) {
        return;
    }
    vscode.postMessage({
        command: 'openFile',
        filePath: filePath
    });
}



function initializeFilters() {
    const depcsFilter = document.getElementById('dependenciesFilter');
    const deptsFilter = document.getElementById('dependentsFilter');
    const catFilter = document.getElementById('categoryFilter');
    const resetButton = document.getElementById('resetFiltersButton');

    // Check if the network instance is available
    if (window.network) {
        networkInstance = window.network;

        // Attach event listeners to the filters
        depcsFilter.addEventListener('input', applyFilters);
        deptsFilter.addEventListener('input', applyFilters);
        catFilter.addEventListener('change', applyFilters);
        resetButton.addEventListener('click', resetFilters);

        // Call populateNodeSelect after the network is initialized
        populateNodeSelect();

        // Attach the node click event listener
        networkInstance.on('selectNode', handleNodeClick);
    } else {
        console.log("Network instance is not ready.");
    }
}


// Function to populate the node select dropdown
function populateNodeSelect() {
    if (!networkInstance) {
        console.log("Network instance is not ready.");
        return;
    }

    const nodes = networkInstance.body.data.nodes;
    const nodeSearchInput = document.getElementById('nodeSearch');
    const suggestionsDiv = document.getElementById('suggestions');

    // Clear suggestions
    suggestionsDiv.innerHTML = '';

    nodes.get().forEach(node => {
        const suggestionDiv = document.createElement('div');
        suggestionDiv.textContent = node.label || node.id;
        suggestionDiv.onclick = function() {
            // Select node when clicked
            nodeSearchInput.value = node.label || node.id;
            suggestionsDiv.style.display = 'none';  // Hide suggestions after selection
            updateGraphWithSelection([node.id]);
        };
        suggestionsDiv.appendChild(suggestionDiv);
    });
}


function zoomToBoundingBox(nodesToZoom) {
    // Get the positions of the nodes to zoom
    const positions = networkInstance.getPositions(nodesToZoom);
    const nodeSizes = nodesToZoom.map(node => networkInstance.body.nodes[node].options.size || 20);  // Default size 20 if not specified

    // Calculate the bounding box considering node size
    const xCoords = Object.values(positions).map(pos => pos.x);
    const yCoords = Object.values(positions).map(pos => pos.y);

    const minX = Math.min(...xCoords);
    const maxX = Math.max(...xCoords);
    const minY = Math.min(...yCoords);
    const maxY = Math.max(...yCoords);

    // Add padding based on node size
    const padding = 0.15;  // Overall padding factor for the bounding box
    const maxNodeSize = Math.max(...nodeSizes);  // Largest node size to prevent tight zoom
    const extraPadding = maxNodeSize * 0.5; // Extra padding to account for node size

    // Update bounding box with additional padding for node size
    const adjustedMinX = minX - extraPadding;
    const adjustedMaxX = maxX + extraPadding;
    const adjustedMinY = minY - extraPadding;
    const adjustedMaxY = maxY + extraPadding;

    // Calculate the center of the adjusted bounding box
    const centerX = (adjustedMinX + adjustedMaxX) / 2;
    const centerY = (adjustedMinY + adjustedMaxY) / 2;

    // Calculate the zoom factor considering the adjusted bounding box and available space (500px height)
    const heightAvailable = 500;  // Fixed height for the available space
    const widthAvailable = networkInstance.canvas.frame.canvas.width;  // Use available width

    const boundingBoxHeight = adjustedMaxY - adjustedMinY;
    const boundingBoxWidth = adjustedMaxX - adjustedMinX;

    const zoomFactorHeight = heightAvailable / boundingBoxHeight * (1 + padding);
    const zoomFactorWidth = widthAvailable / boundingBoxWidth * (1 + padding);

    // Use the smaller zoom factor to ensure both width and height fit
    let zoomFactor = Math.min(zoomFactorHeight, zoomFactorWidth);

    // Prevent zoom factor from being too large (no excessive zoom-out)
    const maxZoom = 1.5;  // Maximum zoom-out limit
    const minZoom = 0.5;  // Minimum zoom-in limit
    zoomFactor = Math.max(zoomFactor, minZoom);
    zoomFactor = Math.min(zoomFactor, maxZoom);

    // Apply zoom and move to center with animation
    networkInstance.moveTo({
        position: { x: centerX, y: centerY },  // Move to the center of the bounding box
        scale: zoomFactor,  // Apply the zoom level
        animation: {
            duration: 1000,  // Smooth transition duration in ms
            easingFunction: "easeInOutQuad"  // Optional easing function for smooth animation
        }
    });
}



// Search function to filter suggestions based on input
function searchNodes() {
    const searchQuery = document.getElementById('nodeSearch').value.toLowerCase();
    const suggestionsDiv = document.getElementById('suggestions');
    const clearButton = document.getElementById('clearSearch');

    if (!networkInstance) {
        console.log("Network instance is not ready.");
        return;
    }

    const nodes = networkInstance.body.data.nodes;
    const edges = networkInstance.body.data.edges;
    const filteredNodes = nodes.get().filter(node => 
        (node.label || '').toLowerCase().includes(searchQuery)
    );

    suggestionsDiv.innerHTML = '';
    filteredNodes.forEach(node => {
        const suggestionDiv = document.createElement('div');
        suggestionDiv.textContent = node.label || node.id;
        suggestionDiv.onclick = function() {
            document.getElementById('nodeSearch').value = node.label || node.id;
            suggestionsDiv.style.display = 'none';

            const nodeId = node.id;
            if (nodeId === previouslySelectedNodeId) {
                // If the same node is selected again, reset the graph
                resetGraph();
                previouslySelectedNodeId = null;
            } else {
                // Hide all nodes and edges
                nodes.get().forEach(n => {
                    nodes.update({ id: n.id, hidden: true });
                });
                edges.get().forEach(edge => {
                    edges.update({ id: edge.id, hidden: true });
                });

                // Get connected edges and make them visible
                const connectedEdges = edges.get({ 
                    filter: e => e.from === nodeId || e.to === nodeId 
                });

                // Make the selected node visible
                nodes.update({ id: nodeId, hidden: false });

                // Make connected nodes and edges visible
                connectedEdges.forEach(edge => {
                    edges.update({ id: edge.id, hidden: false });
                    const otherNodeId = edge.from === nodeId ? edge.to : edge.from;
                    nodes.update({ id: otherNodeId, hidden: false });
                });

                // Track the selected node
                previouslySelectedNodeId = nodeId;

                // Get all connected nodes for zooming
                const connectedNodes = new Set();
                connectedEdges.forEach(edge => {
                    connectedNodes.add(edge.from);
                    connectedNodes.add(edge.to);
                });
                connectedNodes.add(nodeId);

                // Zoom to show the selected node and its connections
                zoomToBoundingBox(Array.from(connectedNodes));
                const filePath = node.file_path || null;
                openFile(filePath)
            }
        };
        suggestionsDiv.appendChild(suggestionDiv);
    });

    suggestionsDiv.style.display = filteredNodes.length > 0 ? 'block' : 'none';
    clearButton.style.display = searchQuery ? 'block' : 'none';
    }


function applyFilters() {
    if (!networkInstance) {
        console.log("Network is not initialized yet.");
        return;
    }

    const dependenciesFilter = parseInt(document.getElementById('dependenciesFilter').value) || 0;
    const dependentsFilter = parseInt(document.getElementById('dependentsFilter').value) || 0;
    const categoryFilter = document.getElementById('categoryFilter').value;

    const nodes = networkInstance.body.data.nodes;

    nodes.get().forEach(node => {
        const meetsDependenciesFilter = dependenciesFilter === 0 || (node.dependencies || 0) >= dependenciesFilter;
        const meetsDependentsFilter = dependentsFilter === 0 || (node.dependents || 0) >= dependentsFilter;
        const meetsCatFilter = categoryFilter === '' || node.category === categoryFilter;
        const visible = meetsDependenciesFilter && meetsDependentsFilter && meetsCatFilter;

        nodes.update({
            id: node.id,
            hidden: !visible
        });
    });
}


function updateGraphWithSelection(selectedNodeIds) {
    if (!networkInstance) {
        console.log("Network is not initialized yet.");
        return;
    }

    const nodes = networkInstance.body.data.nodes;
    const edges = networkInstance.body.data.edges;

    console.log("Selected Nodes: ", selectedNodeIds);

    // Hide all nodes and edges first
    nodes.get().forEach(node => {
        console.log(`Hiding node ${node.id}`);
        nodes.update({ id: node.id, hidden: true });
    });
    edges.get().forEach(edge => {
        console.log(`Hiding edge ${edge.id}`);
        edges.update({ id: edge.id, hidden: true });
    });

    // Show the selected node and its dependencies (edges and other nodes)
    selectedNodeIds.forEach(nodeId => {
        const node = nodes.get(nodeId);
        if (node) {
            console.log(`Showing selected node: ${nodeId}`);
            nodes.update({ id: nodeId, hidden: false });

            // Show the edges connected to the selected node
            const connectedEdges = edges.get({ filter: e => e.from === nodeId || e.to === nodeId });
            connectedEdges.forEach(edge => {
                console.log(`Showing edge: ${edge.id}`);
                edges.update({ id: edge.id, hidden: false });

                // Show the nodes connected by the edges (the other end of the edges)
                const otherNodeId = edge.from === nodeId ? edge.to : edge.from;
                console.log(`Showing connected node: ${otherNodeId}`);
                nodes.update({ id: otherNodeId, hidden: false });
            });
            }
        });
    }

    let previouslySelectedNodeId = null; // Track the last clicked node

function handleNodeClick(event) {
    const nodeId = event.nodes[0]; // Get the clicked node's ID
    const nodes = networkInstance.body.data.nodes;
    const edges = networkInstance.body.data.edges;

    const node = nodes.get(nodeId);

    if (node) {
        if (nodeId === previouslySelectedNodeId) {
            // If the same node is clicked again, reset the graph
            resetGraph();
            previouslySelectedNodeId = null; // Reset tracking variable
        } else {
            // First click on a node: hide all other nodes and edges
            // Show only the clicked node and its connected nodes
            const connectedEdges = edges.get({ filter: e => e.from === nodeId || e.to === nodeId });

            // Hide all nodes and edges
            nodes.get().forEach(n => {
                nodes.update({ id: n.id, hidden: true });
            });
            edges.get().forEach(edge => {
                edges.update({ id: edge.id, hidden: true });
            });

            // Make the clicked node and its connected nodes visible
            nodes.update({ id: nodeId, hidden: false });
            connectedEdges.forEach(edge => {
                edges.update({ id: edge.id, hidden: false });
                const otherNodeId = edge.from === nodeId ? edge.to : edge.from;
                nodes.update({ id: otherNodeId, hidden: false });
            });

            // Track the clicked node as the isolated node
            previouslySelectedNodeId = nodeId;

            // Get the connected nodes to zoom and center
            const connectedNodes = new Set();
            connectedEdges.forEach(edge => {
                connectedNodes.add(edge.from);
                connectedNodes.add(edge.to);
            });

            // Include the selected node itself
            connectedNodes.add(nodeId);

            // Apply zoom and centering to the selected node and its connected nodes
            zoomToBoundingBox(Array.from(connectedNodes));
            const filePath = node.file_path || null; // Ensuring it returns null if undefined
            openFile(filePath);
        }
    } else {
        // Reset the graph if no node is clicked
        resetGraph();
    }
}


function resetGraph() {
    const nodes = networkInstance.body.data.nodes;
    const edges = networkInstance.body.data.edges;

    // Reset visibility for all nodes and edges
    nodes.get().forEach(n => {
        nodes.update({ id: n.id, hidden: false });
    });
    edges.get().forEach(edge => {
        edges.update({ id: edge.id, hidden: false });
    });

    // Zoom out to fit the entire graph into the viewport
    const padding = 0.1;  // Optional: Add padding around the graph when zooming out

    // Get the positions of all nodes to determine the graph's bounding box
    const positions = networkInstance.getPositions();
    const xCoords = Object.values(positions).map(pos => pos.x);
    const yCoords = Object.values(positions).map(pos => pos.y);

    const minX = Math.min(...xCoords);
    const maxX = Math.max(...xCoords);
    const minY = Math.min(...yCoords);
    const maxY = Math.max(...yCoords);

    // Calculate the center of the graph and the zoom level
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // Calculate a zoom level that fits the whole graph into the screen
    const zoomFactor = Math.min(
        networkInstance.canvas.frame.canvas.width / (maxX - minX) * (1 + padding),
        networkInstance.canvas.frame.canvas.height / (maxY - minY) * (1 + padding)
);

// Apply the zoom-out and center the graph
networkInstance.moveTo({
    position: { x: centerX, y: centerY }, // Center the entire graph
    scale: zoomFactor, // Apply the calculated zoom level
    animation: {
        duration: 1000, // Smooth transition duration in ms
        easingFunction: "easeInOutQuad"  // Optional easing function for smooth animation
    }
});
}


// Function to clear the search input and display the complete graph
function clearSearch() {
    document.getElementById('nodeSearch').value = '';
    document.getElementById('suggestions').innerHTML = '';
    document.getElementById('clearSearch').style.display = 'none';

    // Revert the graph back to its full state (show all nodes and edges)
    if (networkInstance) {
        resetGraph();
    }
}


function resetFilters() {
    // Reset slider values to default
    const depSlider = document.getElementById('dependentsFilter');
    const depFilter = document.getElementById('dependenciesFilter');
    const catFilter = document.getElementById('categoryFilter');
    const searchInput = document.getElementById('nodeSearch');

    // Set default values
    depSlider.value = 0;  // Reset dependents slider to 0
    depFilter.value = 0;  // Reset dependencies filter to 0
    catFilter.value = ""; // Reset category filter to default (all categories)
    searchInput.value = ""; // Reset the search bar

    // Update the filter values displayed on the page
    document.getElementById('dependentsValue').innerText = depSlider.value;
    document.getElementById('dependencyValue').innerText = depFilter.value;

    // Apply the filters again with the reset values
    applyFilters();
    resetGraph();
}