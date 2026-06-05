/**
 * EduTower — AI 回复 Markdown + LaTeX 渲染
 */
(function () {
  "use strict";

  var mathStore = [];

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function extractMath(text) {
    mathStore = [];
    var output = String(text);

    var rules = [
      { pattern: /\\\[([\s\S]*?)\\\]/g, display: true },
      { pattern: /\$\$([\s\S]*?)\$\$/g, display: true },
      { pattern: /\\\(([\s\S]*?)\\\)/g, display: false },
    ];

    rules.forEach(function (rule) {
      output = output.replace(rule.pattern, function (_match, tex) {
        var id = mathStore.length;
        mathStore.push({ tex: tex.trim(), display: rule.display });
        return rule.display ? "\n\n%%MATH_" + id + "_%%\n\n" : "%%MATH_" + id + "_%%";
      });
    });

    return output;
  }

  function renderMath(tex, displayMode) {
    if (typeof katex === "undefined") {
      return escapeHtml(displayMode ? "\\[" + tex + "\\]" : "\\(" + tex + "\\)");
    }

    try {
      return katex.renderToString(tex, {
        displayMode: displayMode,
        throwOnError: false,
        strict: "ignore",
      });
    } catch (_err) {
      return escapeHtml(tex);
    }
  }

  function restoreMath(html) {
    return html.replace(/%%MATH_(\d+)_%%/g, function (_match, idText) {
      var item = mathStore[parseInt(idText, 10)];
      if (!item) return "";

      var rendered = renderMath(item.tex, item.display);
      if (item.display) {
        return '<div class="chat-math chat-math--block">' + rendered + "</div>";
      }
      return '<span class="chat-math chat-math--inline">' + rendered + "</span>";
    });
  }

  function parseMarkdown(text) {
    if (typeof marked === "undefined") {
      return "<p>" + escapeHtml(text).replace(/\n{2,}/g, "</p><p>").replace(/\n/g, "<br>") + "</p>";
    }

    if (typeof marked.setOptions === "function") {
      marked.setOptions({
        gfm: true,
        breaks: true,
        headerIds: false,
        mangle: false,
      });
    }

    if (typeof marked.parse === "function") {
      return marked.parse(text);
    }

    return marked(text);
  }

  function renderMarkdown(text) {
    var prepared = extractMath(text);
    var html = parseMarkdown(prepared);
    return restoreMath(html);
  }

  window.EduTowerChatRender = {
    render: renderMarkdown,
  };
})();
