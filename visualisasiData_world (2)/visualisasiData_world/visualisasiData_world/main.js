// ---------------- CONFIG ----------------
const config = {
  dataPath: "data/world_happiness.csv",
  col: {
    country: "Country",
    year: "Year",
    score: "Happiness Score",
    gdp: "GDP per Capita",
    region: "Region",
    healthy: "Healthy life expectancy",
    freedom: "Freedom to make life choices",
    generosity: "Generosity",
    corruption: "Perceptions of corruption",
  },
};

// ---------------- DOM ----------------
const yearRange = d3.select("#yearRange");
const yearLabel = d3.select("#yearLabel");
const playBtn = d3.select("#playBtn");
const resetBtn = d3.select("#resetBtn");
const regionSelect = d3.select("#regionSelect");
const infoBox = d3.select("#info");

let playing = false,
  playInterval = null,
  selectedCountry = null;

const tooltip = d3
  .select("body")
  .append("div")
  .attr("class", "tooltip")
  .style("opacity", 0);

const mapBox = d3.select("#map");
const scatterBox = d3.select("#scatter");
const lineBox = d3.select("#line");
const mapW = mapBox.node().clientWidth,
  mapH = 520;
const scatterW = scatterBox.node().clientWidth,
  scatterH = 480;
const lineW = lineBox.node().clientWidth,
  lineH = 260;

const mapSvg = mapBox.append("svg").attr("width", "100%").attr("height", mapH);
const scatterSvg = scatterBox
  .append("svg")
  .attr("width", "100%")
  .attr("height", scatterH);
const lineSvg = lineBox
  .append("svg")
  .attr("width", "100%")
  .attr("height", lineH);

const mapG = mapSvg.append("g");
const scatterG = scatterSvg.append("g").attr("transform", "translate(60,40)");
const lineG = lineSvg.append("g").attr("transform", "translate(50,30)");

const projection = d3
  .geoNaturalEarth1()
  .scale(mapW / 1.6 / Math.PI)
  .translate([mapW / 2, mapH / 2]);
const path = d3.geoPath().projection(projection);

const colorScale = d3
  .scaleSequential()
  .interpolator(d3.interpolateYlGnBu)
  .clamp(true);
const regionColor = d3.scaleOrdinal(d3.schemeTableau10);

// country name overrides
const countryNameOverrides = {
  "united states": "United States of America",
  russia: "Russian Federation",
  laos: "Lao People's Democratic Republic",
  "south korea": "Republic of Korea",
  "north korea": "Dem. Rep. Korea",
  iran: "Iran (Islamic Republic of)",
  vietnam: "Viet Nam",
  venezuela: "Venezuela (Bolivarian Republic of)",
  tanzania: "United Republic of Tanzania",
  moldova: "Republic of Moldova",
  syria: "Syrian Arab Republic",
  bolivia: "Bolivia (Plurinational State of)",
  brunei: "Brunei Darussalam",
  "czech republic": "Czechia",
  "congo (kinshasa)": "Democratic Republic of the Congo",
  "congo (brazzaville)": "Republic of the Congo",
  "ivory coast": "Côte d’Ivoire",
  "cape verde": "Cabo Verde",
  swaziland: "Eswatini",
  myanmar: "Myanmar",
  palestine: "Palestine",
  taiwan: "Taiwan",
  macedonia: "North Macedonia",
  kosovo: "Republic of Kosovo",
  "u.s.": "United States of America",
  usa: "United States of America",
  uk: "United Kingdom",
};

function normName(name) {
  if (!name) return "";
  return name
    .trim()
    .toLowerCase()
    .replace(/\s*\(.*\)/, "")
    .replace(/['’]/g, "")
    .replace(/\./g, "");
}

// ---------------- LOAD DATA ----------------
Promise.all([
  d3.json("https://unpkg.com/world-atlas@2.0.2/countries-110m.json"),
  d3.csv(config.dataPath, (d) => ({
    country: d[config.col.country] || d.Country || d.country,
    year: +d[config.col.year] || +d.Year || +d.year,
    score: +d[config.col.score] || +d.Score || +d.score,
    gdp: +d[config.col.gdp] || +d["GDP per capita"] || +d.gdp,
    region: d[config.col.region] || d.Region || d.region || "Other",
    healthy: +d[config.col.healthy] || +d.healthy,
    freedom: +d[config.col.freedom] || +d.freedom,
    generosity: +d[config.col.generosity] || +d.generosity,
    corruption: +d[config.col.corruption] || +d.corruption,
  })),
]).then(([topo, csv]) => {
  const countries = topojson.feature(topo, topo.objects.countries).features;
  const dataByYear = d3.group(csv, (d) => d.year);
  const years = Array.from(new Set(csv.map((d) => d.year))).sort(
    (a, b) => a - b
  );
  const minYear = d3.min(years),
    maxYear = d3.max(years);
  yearRange.attr("min", minYear).attr("max", maxYear).attr("value", maxYear);
  yearLabel.text(yearRange.node().value);

  const regions = Array.from(new Set(csv.map((d) => d.region)))
    .filter((d) => d)
    .sort();
  regions.forEach((r) =>
    regionSelect.append("option").attr("value", r).text(r)
  );

  const scores = csv.map((d) => d.score).filter((d) => !isNaN(d));
  colorScale.domain([d3.min(scores), d3.max(scores)]);

  const geoNameToFeature = new Map();
  countries.forEach((f) => {
    const name =
      f.properties &&
      (f.properties.name || f.properties.NAME || f.properties.adm0_a3);
    if (name) geoNameToFeature.set(name.toLowerCase(), f);
  });

  const datasetCountryNames = Array.from(
    new Set(csv.map((d) => d.country))
  ).filter(Boolean);
  const countryToFeature = new Map();
  datasetCountryNames.forEach((cn) => {
    const n = normName(cn);
    if (countryNameOverrides[n]) {
      const f = geoNameToFeature.get(countryNameOverrides[n].toLowerCase());
      countryToFeature.set(cn, f || null);
      return;
    }
    if (geoNameToFeature.has(n)) {
      countryToFeature.set(cn, geoNameToFeature.get(n));
      return;
    }
    const alt = n
      .replace(/^the\s+/, "")
      .replace(/ republic$/, "")
      .replace(/ kingdom$/, "");
    if (geoNameToFeature.has(alt)) {
      countryToFeature.set(cn, geoNameToFeature.get(alt));
      return;
    }
    let found = null;
    for (const [gname, f] of geoNameToFeature.entries()) {
      if (gname.includes(n) || n.includes(gname)) {
        found = f;
        break;
      }
    }
    countryToFeature.set(cn, found);
  });

  // ---------- DRAW BASE MAP ----------
  mapG
    .selectAll("path.country")
    .data(countries)
    .enter()
    .append("path")
    .attr("class", "country")
    .attr("d", path)
    .attr("fill", "#08101a")
    .attr("stroke", "rgba(255,255,255,0.03)");

  function getDataForYear(year, regionFilter = "All") {
    const arr = dataByYear.get(+year) || [];
    return regionFilter && regionFilter !== "All"
      ? arr.filter((d) => d.region === regionFilter)
      : arr;
  }

  // ---------- GLOBAL SPARKLINE ----------
  const globalAvgByYear = Array.from(
    d3.rollup(
      csv,
      (v) => d3.mean(v, (d) => d.score),
      (d) => d.year
    )
  )
    .map(([year, avg]) => ({ year: +year, avg: +avg }))
    .sort((a, b) => a.year - b.year);

  function renderGlobalSparkline() {
    infoBox.selectAll("*").remove();
    const w = 260,
      h = 48,
      pad = 6;
    const svg = infoBox
      .append("svg")
      .attr("width", w)
      .attr("height", h)
      .style("display", "block");
    const x = d3
      .scaleLinear()
      .domain(d3.extent(globalAvgByYear, (d) => d.year))
      .range([pad, w - pad]);
    const y = d3
      .scaleLinear()
      .domain(d3.extent(globalAvgByYear, (d) => d.avg))
      .range([h - pad, pad]);
    const lineFn = d3
      .line()
      .x((d) => x(d.year))
      .y((d) => y(d.avg))
      .curve(d3.curveMonotoneX);
    svg
      .append("path")
      .datum(globalAvgByYear)
      .attr("d", lineFn)
      .attr("fill", "none")
      .attr("stroke", "#60a5fa")
      .attr("stroke-width", 2);

    const byYearMap = new Map(globalAvgByYear.map((d) => [d.year, d.avg]));
    const avg2019 = byYearMap.get(2019),
      avg2020 = byYearMap.get(2020);
    let annotationText = "";
    if (avg2019 != null && avg2020 != null) {
      const diff = +(avg2020 - avg2019).toFixed(3);
      annotationText =
        diff < 0
          ? `Global average fell by ${Math.abs(
              diff
            )} from 2019 → 2020 (pandemic effect)`
          : diff > 0
          ? `Global average rose by ${diff} from 2019 → 2020`
          : `No major change 2019 → 2020 (Δ ${diff})`;
    } else {
      annotationText = "Global trend shown above.";
    }

    infoBox
      .append("div")
      .style("margin-top", "8px")
      .style("color", "#cbd5e1")
      .style("font-size", "13px")
      .html(`<strong>Global avg happiness</strong><br/>${annotationText}`);
  }

  // ---------- UPDATE MAP ----------
  function updateMap(year, regionFilter) {
    const rows = getDataForYear(year, regionFilter);
    const scoreByCountry = new Map(rows.map((r) => [r.country, r.score]));
    const rowByNorm = new Map(rows.map((r) => [normName(r.country), r]));
    mapG
      .selectAll("path.country")
      .transition()
      .duration(600)
      .attr("fill", (d) => {
        for (const [dsName, feat] of countryToFeature.entries()) {
          if (!feat) continue;
          if (feat === d) {
            const v = scoreByCountry.get(dsName);
            return v != null && !isNaN(v) ? colorScale(v) : "#08101a";
          }
        }
        const gname = (d.properties && d.properties.name).toLowerCase();
        for (const [k, v] of scoreByCountry.entries()) {
          if (k.toLowerCase() === gname) return colorScale(v);
        }
        return "#08101a";
      });

    mapG
      .selectAll("path.country")
      .on("mouseenter", function (event, d) {
        let r = null;
        for (const [dsName, feat] of countryToFeature.entries()) {
          if (feat === d) {
            r = rowByNorm.get(normName(dsName));
            break;
          }
        }
        const gname = (d.properties && d.properties.name).toLowerCase();
        if (!r) r = rowByNorm.get(gname);
        if (r) {
          tooltip
            .style("opacity", 1)
            .html(
              `<strong>${r.country}</strong><br/>Score: ${
                r.score
              }<br/>GDP: ${formatNumber(r.gdp)}<br/>Region: ${r.region}`
            )
            .style("left", event.pageX + 12 + "px")
            .style("top", event.pageY + 12 + "px");
          hoverHighlight(r.country);
        } else {
          tooltip
            .style("opacity", 1)
            .html(
              `<strong>${
                d.properties && (d.properties.name || "Unknown")
              }</strong><br/>No data for ${year}`
            )
            .style("left", event.pageX + 12 + "px")
            .style("top", event.pageY + 12 + "px");
          hoverHighlight(null);
        }
      })
      .on("mousemove", (event) =>
        tooltip
          .style("left", event.pageX + 12 + "px")
          .style("top", event.pageY + 12 + "px")
      )
      .on("mouseleave", () => {
        tooltip.style("opacity", 0);
        hoverHighlight(selectedCountry);
      })
      .on("click", (event, d) => {
        for (const [cn, f] of countryToFeature.entries()) {
          if (f === d) {
            selectedCountry = cn;
            updateLineChart(cn);
            renderCountryInfo(cn);
            hoverHighlight(cn);
            break;
          }
        }
      });
  }

  // ---------- UPDATE SCATTER ----------
  function updateScatter(year, regionFilter) {
    const rows = getDataForYear(year, regionFilter).filter(
      (d) => !isNaN(d.gdp) && !isNaN(d.score)
    );
    const xDomain = d3.extent(rows, (d) => d.gdp),
      yDomain = d3.extent(rows, (d) => d.score);
    const xScale = d3
      .scaleLinear()
      .domain([xDomain[0] * 0.9, xDomain[1] * 1.1])
      .range([0, scatterW - 140]);
    const yScale = d3
      .scaleLinear()
      .domain([yDomain[0] * 0.9, yDomain[1] * 1.1])
      .range([scatterH - 100, 0]);
    scatterG.selectAll("*").remove();

    // axis
    const xAxis = d3.axisBottom(xScale).ticks(6).tickFormat(d3.format(".2s"));
    const yAxis = d3.axisLeft(yScale).ticks(6);
    scatterG
      .append("g")
      .attr("transform", `translate(0,${scatterH - 100})`)
      .call(xAxis)
      .selectAll("text")
      .attr("fill", "#cbd5e1");
    scatterG.append("g").call(yAxis).selectAll("text").attr("fill", "#cbd5e1");

    scatterG
      .append("text")
      .attr("x", (scatterW - 140) / 2)
      .attr("y", scatterH - 60)
      .attr("text-anchor", "middle")
      .attr("fill", "#cbd5e1")
      .text("GDP per Capita");
    scatterG
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -(scatterH - 100) / 2)
      .attr("y", -40)
      .attr("text-anchor", "middle")
      .attr("fill", "#cbd5e1")
      .text("Happiness Score");

    scatterG
      .selectAll("circle.point")
      .data(rows, (d) => d.country)
      .join("circle")
      .attr("class", "point")
      .attr("cx", (d) => xScale(d.gdp))
      .attr("cy", (d) => yScale(d.score))
      .attr("r", 5)
      .attr("fill", (d) => regionColor(d.region))
      .attr("opacity", 0.9)
      .on("mouseenter", (event, d) => {
        tooltip
          .style("opacity", 1)
          .html(
            `<strong>${d.country}</strong><br/>Score: ${
              d.score
            }<br/>GDP: ${formatNumber(d.gdp)}<br/>Region: ${d.region}`
          )
          .style("left", event.pageX + 12 + "px")
          .style("top", event.pageY + 12 + "px");
        hoverHighlight(d.country);
      })
      .on("mousemove", (event) =>
        tooltip
          .style("left", event.pageX + 12 + "px")
          .style("top", event.pageY + 12 + "px")
      )
      .on("mouseleave", () => {
        tooltip.style("opacity", 0);
        hoverHighlight(selectedCountry);
      })
      .on("click", (event, d) => {
        selectedCountry = d.country;
        updateLineChart(d.country);
        renderCountryInfo(d.country);
        hoverHighlight(d.country);
      });

    // legend
    const legend = scatterG
      .append("g")
      .attr("transform", `translate(${scatterW - 240},10)`);
    regionColor.domain().forEach((r, i) => {
      const g = legend.append("g").attr("transform", `translate(0,${i * 20})`);
      g.append("rect")
        .attr("width", 12)
        .attr("height", 12)
        .attr("fill", regionColor(r));
      g.append("text")
        .attr("x", 18)
        .attr("y", 10)
        .attr("fill", "#cbd5e1")
        .text(r)
        .attr("font-size", 12);
    });
  }

  // ---------- UPDATE LINE CHART ----------
  function updateLineChart(country) {
    if (!country) return;
    const rows = csv
      .filter((d) => d.country === country && !isNaN(d.score))
      .sort((a, b) => a.year - b.year);
    if (!rows.length) return;

    const xScale = d3
      .scaleLinear()
      .domain(d3.extent(rows, (d) => d.year))
      .range([0, lineW - 100]);
    const yScale = d3
      .scaleLinear()
      .domain(d3.extent(rows, (d) => d.score))
      .range([lineH - 60, 0]);

    lineG.selectAll("*").remove();

    const xAxis = d3.axisBottom(xScale).ticks(6).tickFormat(d3.format("d"));
    const yAxis = d3.axisLeft(yScale).ticks(6);
    lineG
      .append("g")
      .attr("transform", `translate(0,${lineH - 60})`)
      .call(xAxis)
      .selectAll("text")
      .attr("fill", "#cbd5e1");
    lineG.append("g").call(yAxis).selectAll("text").attr("fill", "#cbd5e1");

    const lineFn = d3
      .line()
      .x((d) => xScale(d.year))
      .y((d) => yScale(d.score))
      .curve(d3.curveMonotoneX);

    lineG
      .append("path")
      .datum(rows)
      .attr("d", lineFn)
      .attr("fill", "none")
      .attr("stroke", "#60a5fa")
      .attr("stroke-width", 2);

    lineG
      .selectAll("circle.point")
      .data(rows)
      .join("circle")
      .attr("class", "point")
      .attr("cx", (d) => xScale(d.year))
      .attr("cy", (d) => yScale(d.score))
      .attr("r", 4)
      .attr("fill", "#2563eb")
      .on("mouseenter", (event, d) => {
        tooltip
          .style("opacity", 1)
          .html(
            `<strong>${d.country}</strong><br/>Year: ${d.year}<br/>Score: ${d.score}`
          )
          .style("left", event.pageX + 12 + "px")
          .style("top", event.pageY + 12 + "px");
      })
      .on("mousemove", (event) =>
        tooltip
          .style("left", event.pageX + 12 + "px")
          .style("top", event.pageY + 12 + "px")
      )
      .on("mouseleave", () => tooltip.style("opacity", 0));
  }

  // ---------- COUNTRY INFO ----------
  function renderCountryInfo(country) {
    infoBox.selectAll("*").remove();
    if (!country) return;
    const rows = csv
      .filter((d) => d.country === country)
      .sort((a, b) => a.year - b.year);
    if (!rows.length) return;
    const latest = rows[rows.length - 1];
    const html = `
      <h4>${latest.country}</h4>
      <p>Year: ${latest.year}<br/>
      Score: ${latest.score}<br/>
      GDP per Capita: ${formatNumber(latest.gdp)}<br/>
      Region: ${latest.region}<br/>
      Healthy life: ${latest.healthy}<br/>
      Freedom: ${latest.freedom}<br/>
      Generosity: ${latest.generosity}<br/>
      Corruption: ${latest.corruption}</p>
    `;
    infoBox.html(html);
    renderGlobalSparkline();
  }

  // ---------- HIGHLIGHT ----------
  function hoverHighlight(country) {
    mapG.selectAll("path.country").attr("stroke-width", (d) => {
      for (const [dsName, feat] of countryToFeature.entries()) {
        if (feat === d && dsName === country) return 2;
      }
      return 0.5;
    });
  }

  function formatNumber(num) {
    if (num == null || isNaN(num)) return "-";
    if (num >= 1e9) return (num / 1e9).toFixed(1) + "B";
    if (num >= 1e6) return (num / 1e6).toFixed(1) + "M";
    if (num >= 1e3) return (num / 1e3).toFixed(1) + "K";
    return num.toFixed(2);
  }

  // ---------- EVENT BIND ----------
  function updateAll() {
    const year = +yearRange.node().value;
    const region = regionSelect.node().value;
    yearLabel.text(year);
    updateMap(year, region);
    updateScatter(year, region);
    if (selectedCountry) {
      updateLineChart(selectedCountry);
      renderCountryInfo(selectedCountry);
    }
  }

  yearRange.on("input", updateAll);
  regionSelect.on("change", updateAll);

  playBtn.on("click", () => {
    if (playing) {
      clearInterval(playInterval);
      playBtn.text("▶ Play");
      playing = false;
    } else {
      playing = true;
      playBtn.text("⏸ Pause");
      playInterval = setInterval(() => {
        let y = +yearRange.node().value;
        if (y >= maxYear) y = minYear;
        else y++;
        yearRange.node().value = y;
        updateAll();
      }, 1200);
    }
  });

  resetBtn.on("click", () => {
    yearRange.node().value = maxYear;
    regionSelect.node().value = "All";
    selectedCountry = null;
    updateAll();
  });

  updateAll();
});
