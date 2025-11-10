// landsat.js — Scatter plot interaktif untuk dataset Landsat (statlog)
(function () {
  const datasetSelect = document.getElementById("datasetSelect");
  const xSelect = document.getElementById("xSelect");
  const ySelect = document.getElementById("ySelect");
  const classFilter = document.getElementById("classFilter");
  const chartEl = document.getElementById("chart");
  const tooltip = d3.select("#tooltip");
  const datasetInfo = document.getElementById("datasetInfo");

  let data = [];
  let numericCols = [];
  let classValues = [];

  // color palette (earth-like colors)
  const palette = [
    "#2b6cb0",
    "#38a169",
    "#dd6b20",
    "#d53f8c",
    "#805ad5",
    "#718096",
    "#e53e3e",
  ];
  const color = d3.scaleOrdinal(palette);

  const margin = { top: 18, right: 18, bottom: 48, left: 58 };
  let svg, width, height, xScale, yScale, xAxisG, yAxisG;

  function init() {
    // load default dataset (attempt landsat.csv then fallback to sample)
    loadDataset(datasetSelect.value);
    datasetSelect.addEventListener("change", () =>
      loadDataset(datasetSelect.value)
    );
    xSelect.addEventListener("change", update);
    ySelect.addEventListener("change", update);
    classFilter.addEventListener("change", update);
    document.getElementById("btnReset").addEventListener("click", () => {
      xSelect.selectedIndex = 0;
      ySelect.selectedIndex = 1;
      classFilter.value = "all";
      update();
    });
    window.addEventListener("resize", resize);
  }

  function loadDataset(path) {
    datasetInfo.textContent = `Memuat ${path} ...`;
    d3.csv(path)
      .then((rows) => {
        data = rows.map((r) => {
          // convert numeric values where possible
          const out = {};
          Object.keys(r).forEach((k) => {
            const v = r[k];
            const n = +v;
            out[k.trim()] =
              v === null || v === undefined || v === ""
                ? null
                : isNaN(n)
                ? v.trim()
                : n;
          });
          return out;
        });
        postLoad();
      })
      .catch((err) => {
        console.warn("Gagal muat", path, err);
        // try sample path relative
        if (!path.endsWith("landsat_sample.csv")) {
          loadDataset("/data/landsat_sample.csv");
        } else {
          datasetInfo.textContent = "Gagal memuat dataset sample.";
        }
      });
  }

  function postLoad() {
    // detect numeric columns (sample first row)
    const sample = data[0] || {};
    numericCols = Object.keys(sample).filter(
      (k) => typeof sample[k] === "number"
    );
    // detect class column candidates: non-numeric or 'class' named
    const allCols = Object.keys(sample);
    let classCol =
      allCols.find((c) => /class|target|label/i.test(c)) ||
      allCols[allCols.length - 1];

    // populate selects
    xSelect.innerHTML = "";
    ySelect.innerHTML = "";
    numericCols.forEach((c, i) => {
      const optX = document.createElement("option");
      optX.value = c;
      optX.textContent = c;
      xSelect.appendChild(optX);
      const optY = document.createElement("option");
      optY.value = c;
      optY.textContent = c;
      ySelect.appendChild(optY);
    });
    // default select first two numeric cols
    if (numericCols.length > 1) {
      xSelect.value = numericCols[0];
      ySelect.value = numericCols[1];
    }

    // classes
    classValues = Array.from(new Set(data.map((d) => d[classCol]))).sort();
    classFilter.innerHTML =
      '<option value="all">All classes</option>' +
      classValues.map((v) => `<option value="${v}">${v}</option>`).join("");

    datasetInfo.textContent = `Loaded ${data.length} rows — numeric columns: ${numericCols.length}`;

    createSVG();
    update();
  }

  function createSVG() {
    chartEl.innerHTML = "";
    const rect = chartEl.getBoundingClientRect();
    width = Math.max(320, rect.width - margin.left - margin.right);
    height = 420 - margin.top - margin.bottom;

    svg = d3
      .select("#chart")
      .append("svg")
      .attr(
        "viewBox",
        `0 0 ${width + margin.left + margin.right} ${
          height + margin.top + margin.bottom
        }`
      )
      .attr("preserveAspectRatio", "xMidYMid meet")
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    xAxisG = svg
      .append("g")
      .attr("class", "x axis")
      .attr("transform", `translate(0,${height})`);
    yAxisG = svg.append("g").attr("class", "y axis");
    // axis labels
    svg
      .append("text")
      .attr("class", "x label")
      .attr("text-anchor", "end")
      .attr("x", width)
      .attr("y", height + 36)
      .attr("fill", "#9aa4b2");
    svg
      .append("text")
      .attr("class", "y label")
      .attr("text-anchor", "end")
      .attr("transform", "rotate(-90)")
      .attr("x", -10)
      .attr("y", -40)
      .attr("fill", "#9aa4b2");

    // legend container
    svg
      .append("g")
      .attr("class", "legend")
      .attr("transform", `translate(${width - 80},0)`);
  }

  function update() {
    if (!svg) createSVG();
    const xKey = xSelect.value;
    const yKey = ySelect.value;
    const classVal = classFilter.value;
    if (!xKey || !yKey) return;

    const filtered = data.filter(
      (d) =>
        d[xKey] !== null &&
        d[yKey] !== null &&
        (classVal === "all" ? true : d[classValKey(d)] == classVal)
    );

    // compute scales
    xScale = d3
      .scaleLinear()
      .domain(d3.extent(data, (d) => +d[xKey]))
      .nice()
      .range([0, width]);
    yScale = d3
      .scaleLinear()
      .domain(d3.extent(data, (d) => +d[yKey]))
      .nice()
      .range([height, 0]);

    // axes with transition
    xAxisG
      .transition()
      .duration(600)
      .call(d3.axisBottom(xScale).ticks(8))
      .selectAll("text")
      .attr("fill", "#9aa4b2");
    yAxisG
      .transition()
      .duration(600)
      .call(d3.axisLeft(yScale).ticks(6))
      .selectAll("text")
      .attr("fill", "#9aa4b2");

    svg.select(".x.label").text(xKey);
    svg.select(".y.label").text(yKey);

    // join data
    const points = svg.selectAll(".point").data(filtered, (d, i) => i);

    // exit
    points.exit().transition().duration(500).attr("r", 0).remove();

    // update
    points
      .transition()
      .duration(800)
      .ease(d3.easeCubicOut)
      .attr("cx", (d) => xScale(d[xKey]))
      .attr("cy", (d) => yScale(d[yKey]));

    // enter
    points
      .enter()
      .append("circle")
      .attr("class", "point")
      .attr("cx", (d) => xScale(d[xKey]))
      .attr("cy", (d) => yScale(d[yKey]))
      .attr("r", 0)
      .attr("fill", (d) => color(d[classValKey(d)]))
      .attr("opacity", 0.85)
      .on("mouseenter", (e, d) => showTooltip(e, d, xKey, yKey))
      .on("mousemove", (e, d) => moveTooltip(e))
      .on("mouseleave", hideTooltip)
      .transition()
      .duration(700)
      .attr("r", 4.5);

    renderLegend();
  }

  // helper to guess the class column key
  function classValKey(d) {
    // try common names
    for (const k of Object.keys(d)) {
      if (/class|target|label|landcover|category/i.test(k)) return k;
    }
    // fallback last key
    return Object.keys(d).slice(-1)[0];
  }

  function renderLegend() {
    const legendG = svg.select(".legend");
    const classes = Array.from(
      new Set(data.map((d) => d[classValKey(d)]))
    ).slice(0, 7);
    legendG.selectAll("*").remove();
    classes.forEach((c, i) => {
      const g = legendG
        .append("g")
        .attr("transform", `translate(0, ${i * 20})`);
      g.append("rect")
        .attr("width", 12)
        .attr("height", 12)
        .attr("fill", color(c));
      g.append("text")
        .attr("x", 16)
        .attr("y", 10)
        .attr("fill", "#cbd5e1")
        .attr("font-size", 12)
        .text(c);
    });
  }

  function resize() {
    if (!svg) return; // recreate svg for simplicity
    createSVG();
    update();
  }

  function showTooltip(event, d, xKey, yKey) {
    tooltip
      .style("display", "block")
      .html(
        `<strong>Class:</strong> ${
          d[classValKey(d)]
        }<br/><strong>${xKey}:</strong> ${
          d[xKey]
        }<br/><strong>${yKey}:</strong> ${d[yKey]}`
      )
      .style("left", event.pageX + 12 + "px")
      .style("top", event.pageY + 12 + "px");
  }
  function moveTooltip(event) {
    tooltip
      .style("left", event.pageX + 12 + "px")
      .style("top", event.pageY + 12 + "px");
  }
  function hideTooltip() {
    tooltip.style("display", "none");
  }

  // init
  init();
})();
