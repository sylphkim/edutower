/**
 * EduTower — 侧栏名言随机切换
 */
(function () {
  "use strict";

  var QUOTES = [
    {
      text: "学而时习之，不亦说乎。有朋自远方来，不亦乐乎。",
      source: "—— 《论语·学而》",
    },
    {
      text: "温故而知新，可以为师矣。",
      source: "—— 《论语·为政》",
    },
    {
      text: "学而不思则罔，思而不学则殆。",
      source: "—— 《论语·为政》",
    },
    {
      text: "知之者不如好之者，好之者不如乐之者。",
      source: "—— 《论语·雍也》",
    },
    {
      text: "三人行，必有我师焉。择其善者而从之，其不善者而改之。",
      source: "—— 《论语·述而》",
    },
    {
      text: "博学之，审问之，慎思之，明辨之，笃行之。",
      source: "—— 《礼记·中庸》",
    },
    {
      text: "书山有路勤为径，学海无涯苦作舟。",
      source: "—— 韩愈",
    },
    {
      text: "业精于勤，荒于嬉；行成于思，毁于随。",
      source: "—— 韩愈",
    },
    {
      text: "少壮不努力，老大徒伤悲。",
      source: "—— 《长歌行》",
    },
    {
      text: "锲而不舍，金石可镂。",
      source: "—— 《荀子·劝学》",
    },
    {
      text: "不积跬步，无以至千里；不积小流，无以成江海。",
      source: "—— 《荀子·劝学》",
    },
    {
      text: "问渠那得清如许？为有源头活水来。",
      source: "—— 朱熹《观书有感》",
    },
  ];

  var ROTATE_MS = 45000;
  var quoteBox = document.getElementById("sidebarQuote");
  var quoteTextEl = document.getElementById("sidebarQuoteText");
  var quoteSourceEl = document.getElementById("sidebarQuoteSource");
  var currentIndex = -1;
  var rotateTimer = null;

  if (!quoteBox || !quoteTextEl || !quoteSourceEl) {
    return;
  }

  function pickRandomIndex() {
    if (QUOTES.length <= 1) return 0;

    var nextIndex = currentIndex;
    var guard = 0;
    while (nextIndex === currentIndex && guard < 8) {
      nextIndex = Math.floor(Math.random() * QUOTES.length);
      guard += 1;
    }
    return nextIndex;
  }

  function renderQuote(index, animate) {
    var quote = QUOTES[index];
    if (!quote) return;

    currentIndex = index;

    function applyText() {
      quoteTextEl.textContent = quote.text;
      quoteSourceEl.textContent = quote.source;
    }

    if (!animate) {
      applyText();
      return;
    }

    quoteBox.classList.add("sidebar-quote--changing");
    window.setTimeout(function () {
      applyText();
      quoteBox.classList.remove("sidebar-quote--changing");
    }, 180);
  }

  function showRandomQuote(animate) {
    renderQuote(pickRandomIndex(), animate !== false);
  }

  function startAutoRotate() {
    if (rotateTimer) {
      window.clearInterval(rotateTimer);
    }
    rotateTimer = window.setInterval(function () {
      showRandomQuote(true);
    }, ROTATE_MS);
  }

  quoteBox.addEventListener("click", function () {
    showRandomQuote(true);
    startAutoRotate();
  });

  showRandomQuote(false);
  startAutoRotate();

  window.EduTowerQuotes = {
    next: showRandomQuote,
    getAll: function () {
      return QUOTES.slice();
    },
  };
})();
