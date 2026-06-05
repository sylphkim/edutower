/**
 * EduTower — 知识图谱渲染（D3 力导向，拖拽带物理跟随）
 */
(function () {
  "use strict";

  var state = null;

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function nodeRadius(node) {
    return 14 + (Number(node.weight) || 1) * 4;
  }

  function toSimulationData(graph) {
    var nodes = (graph.nodes || []).map(function (node) {
      return Object.assign({}, node);
    });
    var links = (graph.links || []).map(function (link) {
      return {
        id: link.id,
        source: link.source,
        target: link.target,
        type: link.type || "prerequisite",
      };
    });

    return { nodes: nodes, links: links };
  }

  function renderDetail(detailEl, nodeData) {
    if (!detailEl) return;

    if (!nodeData) {
      detailEl.classList.add("is-hidden");
      detailEl.innerHTML = "";
      return;
    }

    detailEl.classList.remove("is-hidden");
    detailEl.innerHTML =
      '<p class="knowledge-graph-detail__eyebrow">考点详情</p>' +
      '<h3 class="knowledge-graph-detail__title">' +
      escapeHtml(nodeData.label) +
      "</h3>" +
      '<div class="knowledge-graph-detail__meta">' +
      '<span class="knowledge-graph-detail__badge" style="background:' +
      escapeHtml(nodeData.color) +
      '">' +
      escapeHtml(nodeData.masteryLabel) +
      " · " +
      escapeHtml(String(nodeData.masteryPct)) +
      "%</span>" +
      '<span class="knowledge-graph-detail__degree">关联 ' +
      escapeHtml(String(nodeData.degree)) +
      " 条</span></div>" +
      (nodeData.subjectLabel
        ? '<p class="knowledge-graph-detail__subject">' + escapeHtml(nodeData.subjectLabel) + "</p>"
        : "") +
      '<p class="knowledge-graph-detail__desc">' +
      escapeHtml(nodeData.description || "暂无描述") +
      "</p>" +
      '<p class="knowledge-graph-detail__hint">滚轮缩放 · 拖动画布平移 · 拖拽节点带弹性跟随</p>';
  }

  function clearSelection() {
    if (!state) return;
    state.selectedId = null;
    state.nodeGroups.classed("is-selected", false).classed("is-dimmed", false);
    state.labelGroups.classed("is-dimmed", false);
    state.linkLines.classed("is-highlighted", false).classed("is-dimmed", false);
    renderDetail(state.detailEl, null);
  }

  function selectNode(nodeData) {
    if (!state || !nodeData) return;

    state.selectedId = nodeData.id;
    var neighborIds = {};

    state.links.forEach(function (link) {
      var sourceId = typeof link.source === "object" ? link.source.id : link.source;
      var targetId = typeof link.target === "object" ? link.target.id : link.target;
      if (sourceId === nodeData.id) neighborIds[targetId] = true;
      if (targetId === nodeData.id) neighborIds[sourceId] = true;
    });

    state.nodeGroups.classed("is-selected", function (d) {
      return d.id === nodeData.id;
    });
    state.nodeGroups.classed("is-dimmed", function (d) {
      return d.id !== nodeData.id && !neighborIds[d.id];
    });
    state.labelGroups.classed("is-dimmed", function (d) {
      return d.id !== nodeData.id && !neighborIds[d.id];
    });
    state.linkLines.classed("is-highlighted", function (d) {
      var sourceId = typeof d.source === "object" ? d.source.id : d.source;
      var targetId = typeof d.target === "object" ? d.target.id : d.target;
      return sourceId === nodeData.id || targetId === nodeData.id;
    });
    state.linkLines.classed("is-dimmed", function (d) {
      var sourceId = typeof d.source === "object" ? d.source.id : d.source;
      var targetId = typeof d.target === "object" ? d.target.id : d.target;
      return sourceId !== nodeData.id && targetId !== nodeData.id;
    });

    renderDetail(state.detailEl, nodeData);

    if (typeof state.onSelectCallback === "function") {
      state.onSelectCallback(nodeData);
    }
  }

  function createSimulation(nodes, links, width, height, options) {
    options = options || {};
    var linkDistance = options.compact ? 88 : 108;
    var chargeStrength = options.compact ? -320 : -420;

    return d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3
          .forceLink(links)
          .id(function (d) {
            return d.id;
          })
          .distance(linkDistance)
          .strength(0.72)
      )
      .force("charge", d3.forceManyBody().strength(chargeStrength).distanceMax(300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force(
        "collision",
        d3.forceCollide().radius(function (d) {
          return nodeRadius(d) + (options.compact ? 12 : 16);
        })
      )
      .velocityDecay(0.42);
  }

  function pointerToGraph(sourceEvent) {
    if (!state) return [0, 0];
    return d3.zoomTransform(state.svg.node()).invert(d3.pointer(sourceEvent, state.svg.node()));
  }

  function bindDrag(simulation) {
    function dragstarted(event, d) {
      event.sourceEvent.stopPropagation();
      if (!event.active) simulation.alphaTarget(0.28).restart();
      d.fx = d.x;
      d.fy = d.y;
      d3.select(this).classed("is-dragging", true);
      selectNode(d);
    }

    function dragged(event, d) {
      var point = pointerToGraph(event.sourceEvent);
      d.fx = point[0];
      d.fy = point[1];
    }

    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d3.select(this).classed("is-dragging", false);
      d.fx = null;
      d.fy = null;
      simulation.alpha(0.22).restart();
    }

    return d3
      .drag()
      .touchable(true)
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended);
  }

  function ticked(linkLines, nodeGroups, labelGroups) {
    linkLines.attr("d", function (d) {
      var sx = d.source.x;
      var sy = d.source.y;
      var tx = d.target.x;
      var ty = d.target.y;
      var dx = tx - sx;
      var dy = ty - sy;
      var dist = Math.sqrt(dx * dx + dy * dy) || 1;
      var targetRadius = nodeRadius(d.target);
      var endX = tx - (dx / dist) * (targetRadius + 2);
      var endY = ty - (dy / dist) * (targetRadius + 2);
      return "M" + sx + "," + sy + " L" + endX + "," + endY;
    });

    nodeGroups.attr("transform", function (d) {
      return "translate(" + d.x + "," + d.y + ")";
    });

    labelGroups.attr("transform", function (d) {
      return "translate(" + d.x + "," + (d.y + nodeRadius(d) + 14) + ")";
    });
  }

  function mount(container, graph, options) {
    options = options || {};

    if (!container || typeof d3 === "undefined") {
      return false;
    }

    destroy();

    container.innerHTML = "";
    container.classList.toggle("knowledge-graph-host--compact", !!options.compact);

    var canvasWrap = document.createElement("div");
    canvasWrap.className = "knowledge-graph__canvas";
    canvasWrap.id = options.canvasId || "knowledgeGraphCanvas";
    canvasWrap.innerHTML = '<svg class="knowledge-graph__svg" aria-hidden="true"></svg>';

    var detailAside = document.createElement("aside");
    detailAside.className = "knowledge-graph-detail is-hidden";
    detailAside.id = options.detailId || "knowledgeGraphDetail";
    detailAside.setAttribute("aria-live", "polite");

    var legend = document.createElement("div");
    legend.className = "knowledge-graph__legend";
    legend.innerHTML =
      '<span><i class="knowledge-graph__dot knowledge-graph__dot--good"></i>掌握良好</span>' +
      '<span><i class="knowledge-graph__dot knowledge-graph__dot--mid"></i>需要巩固</span>' +
      '<span><i class="knowledge-graph__dot knowledge-graph__dot--weak"></i>薄弱重点</span>';

    container.appendChild(canvasWrap);
    container.appendChild(detailAside);
    container.appendChild(legend);

    var canvas = canvasWrap;
    var svg = d3.select(canvas.querySelector(".knowledge-graph__svg"));
    var detailEl = detailAside;
    var data = toSimulationData(graph);
    var width = canvas.clientWidth || 800;
    var height = canvas.clientHeight || 520;

    svg.attr("viewBox", "0 0 " + width + " " + height).attr("width", "100%").attr("height", "100%");

    var root = svg.append("g").attr("class", "kg-root");

    var zoom = d3
      .zoom()
      .scaleExtent([0.35, 2.4])
      .filter(function (event) {
        if (event.type === "wheel") return true;
        if (event.target && event.target.closest && event.target.closest(".kg-node")) {
          return false;
        }
        return true;
      })
      .on("zoom", function (event) {
        root.attr("transform", event.transform);
      });

    svg.call(zoom).on("dblclick.zoom", null);

    svg.on("click", function (event) {
      if (event.target === svg.node() || event.target.classList.contains("kg-bg")) {
        clearSelection();
      }
    });

    root.append("rect").attr("class", "kg-bg").attr("width", width).attr("height", height).attr("fill", "transparent");

    var defs = root.append("defs");
    defs
      .append("marker")
      .attr("id", "kg-arrow")
      .attr("viewBox", "0 -4 8 8")
      .attr("refX", 7)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-4 L8,0 L0,4")
      .attr("fill", "#b7c2ce");

    var simulation = createSimulation(data.nodes, data.links, width, height, options);
    simulation.alpha(1).restart();

    var linkLines = root
      .append("g")
      .attr("class", "kg-links")
      .selectAll("path")
      .data(data.links)
      .join("path")
      .attr("class", "kg-link");

    var nodeGroups = root
      .append("g")
      .attr("class", "kg-nodes")
      .selectAll("g")
      .data(data.nodes)
      .join("g")
      .attr("class", "kg-node")
      .style("cursor", "grab")
      .call(bindDrag(simulation))
      .on("click", function (event, d) {
        event.stopPropagation();
        selectNode(d);
      });

    nodeGroups
      .append("circle")
      .attr("class", "kg-node__circle")
      .attr("r", function (d) {
        return nodeRadius(d);
      })
      .attr("fill", function (d) {
        return d.color;
      });

    var labelGroups = root
      .append("g")
      .attr("class", "kg-labels")
      .selectAll("text")
      .data(data.nodes)
      .join("text")
      .attr("class", "kg-label")
      .attr("text-anchor", "middle")
      .text(function (d) {
        return d.label;
      });

    simulation.on("tick", function () {
      ticked(linkLines, nodeGroups, labelGroups);
    });

    state = {
      container: container,
      canvas: canvas,
      svg: svg,
      root: root,
      zoom: zoom,
      simulation: simulation,
      nodes: data.nodes,
      links: data.links,
      linkLines: linkLines,
      nodeGroups: nodeGroups,
      labelGroups: labelGroups,
      detailEl: detailEl,
      onSelectCallback: options.onSelect || null,
      width: width,
      height: height,
      selectedId: null,
    };

    return true;
  }

  function destroy() {
    if (state && state.simulation) {
      state.simulation.stop();
    }
    state = null;
  }

  function relayout() {
    if (!state) return;

    clearSelection();
    state.nodes.forEach(function (node) {
      node.fx = null;
      node.fy = null;
      node.vx = 0;
      node.vy = 0;
    });

    state.simulation.alpha(1).restart();
    state.zoom.transform(state.svg.transition().duration(450), d3.zoomIdentity);
  }

  function resize() {
    if (!state) return;

    var width = state.canvas.clientWidth || state.width;
    var height = state.canvas.clientHeight || state.height;
    state.width = width;
    state.height = height;
    state.svg.attr("viewBox", "0 0 " + width + " " + height);
    state.root.select(".kg-bg").attr("width", width).attr("height", height);
    state.simulation.force("center", d3.forceCenter(width / 2, height / 2));
    state.simulation.alpha(0.35).restart();
  }

  window.EduTowerKnowledgeGraph = {
    mount: mount,
    destroy: destroy,
    relayout: relayout,
    resize: resize,
  };
})();
