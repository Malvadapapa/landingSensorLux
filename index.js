const BASE_URL = 'https://websocketwokwi-server.onrender.com';
const GET_DATA_PATH = '/get_data';
const API_URL = `${BASE_URL}${GET_DATA_PATH}`;
const width = 960;
const height = 500;
const marginTop = 20;
const marginRight = 20;
const marginBottom = 30;
const marginLeft = 40;


// Escala de colores actualizada
const color = d3.scaleLinear()
  .domain([0, 6, 12, 18, 24])
  .range(['#1a237e', // Azul muy oscuro (madrugada)
          '#42a5f5', // Azul claro (mañana)  
          '#ffd54f', // Amarillo suave (mediodía)
          '#ff9800', // Naranja (tarde)
          '#1a237e'  // Azul muy oscuro (noche)
        ]);

const fetchDataAndRenderChart = async () => {
  try {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    console.log('Datos obtenidos:', data);

    if (!Array.isArray(data)) {
      throw new Error('Datos no válidos: se esperaba un array');
    }

    const processedData = data.map(d => ({
      id: d.id,
      timestamp: new Date(d.timestamp),
      status: d.led_status && d.led_status.toLowerCase() === 'true' 
    }));


    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const filteredData = processedData.filter(d => 
      (d.timestamp >= yesterday && d.timestamp < today && d.timestamp.getHours() < 6) ||
      (d.timestamp >= today)
    );

    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 7);

    const weeklyData = processedData.filter(d => 
      d.timestamp >= weekAgo && d.timestamp <= now
    );

    const dailyHourlyCounts = d3.rollup(
      filteredData.filter(d => d.status), 
      v => d3.rollup(v, vv => vv.length, d => d.timestamp.getHours()), 
      d => d3.timeDay(d.timestamp) 
    );

    const bins = Array.from(dailyHourlyCounts, ([day, hours]) => ({
      day,
      hours: Array.from(hours, ([hour, count]) => ({ hour, count }))
    }));


    const x = d3.scaleBand()
      .domain(d3.range(24)) 
      .range([marginLeft, width - marginRight])
      .padding(0.1);


    const y = d3.scaleLinear()
      .domain([0, d3.max(bins, d => d3.max(d.hours, h => h.count))])
      .nice()
      .range([height - marginBottom, marginTop]);

    const svg = d3.create("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height])
      .attr("style", "max-width: 100%; height: auto;");


    // Leyenda actualizada con los nuevos colores
    const legendData = [
      { label: "Madrugada (00:00-06:00)", color: "#1a237e" },
      { label: "Mañana (06:00-12:00)", color: "#42a5f5" },
      { label: "Mediodía (12:00-18:00)", color: "#ffd54f" },
      { label: "Tarde (18:00-24:00)", color: "#ff9800" }
    ];


    const legend = svg.append("g")
      .attr("class", "legend")
      .attr("transform", `translate(${width - marginRight - 200}, ${marginTop})`);

    legend.selectAll("rect")
      .data(legendData)
      .join("rect")
      .attr("x", 0)
      .attr("y", (d, i) => i * 20)
      .attr("width", 15)
      .attr("height", 15)
      .attr("fill", d => d.color);

    legend.selectAll("text")
      .data(legendData)
      .join("text")
      .attr("x", 20)
      .attr("y", (d, i) => i * 20 + 12)
      .attr("fill", "white")
      .attr("font-size", "12px")
      .text(d => d.label);

    bins.forEach(dayData => {
      const dayGroup = svg.append("g")
        .attr("transform", `translate(0,${marginTop})`);


      dayGroup.selectAll("rect")
        .data(dayData.hours)
        .join("rect")
        .attr("x", d => x(d.hour))
        .attr("width", x.bandwidth())
        .attr("y", d => y(d.count))
        .attr("height", d => y(0) - y(d.count))
        .attr("fill", d => color(d.hour));


      dayGroup.append("text")
        .attr("x", marginLeft)
        .attr("y", marginTop - 10)
        .attr("fill", "currentColor")
        .attr("text-anchor", "start")
        .text(d3.timeFormat("%Y-%m-%d")(dayData.day));
    });


    svg.append("g")
      .attr("transform", `translate(0,${height - marginBottom})`)
      .call(d3.axisBottom(x).tickFormat(d => `${d}:00`))
      .call(g => g.append("text")
        .attr("x", width)
        .attr("y", marginBottom - 4)
        .attr("fill", "currentColor")
        .attr("text-anchor", "end")
        .text("Hora del día"));


    svg.append("g")
      .attr("transform", `translate(${marginLeft},0)`)
      .call(d3.axisLeft(y).ticks(y.domain()[1]).tickFormat(d3.format("d")))
      .call(g => g.select(".domain").remove())
      .call(g => g.append("text")
        .attr("x", -marginLeft)
        .attr("y", 10)
        .attr("fill", "currentColor")
        .attr("text-anchor", "start")
        .text("↑ Veces encendido"));

    document.getElementById('chart-container').innerHTML = '';
    document.getElementById('chart-container').appendChild(svg.node());


    const totalCount = filteredData.filter(d => d.status).length;
    document.getElementById('total-count').textContent = totalCount;


    const weeklyTotalCount = weeklyData.filter(d => d.status).length;
    document.getElementById('weekly-total-count').textContent = weeklyTotalCount;

    const daysInData = Math.ceil((today - weekAgo) / (1000 * 60 * 60 * 24));
    const dailyAverage = (weeklyTotalCount / daysInData).toFixed(1);
    document.getElementById('daily-average').textContent = dailyAverage;

    const timesList = document.getElementById('times-list');
    timesList.innerHTML = '';
    const lastActivations = filteredData
        .filter(d => d.status)
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 10); 

    lastActivations.forEach(d => {
        const li = document.createElement('li');
        const date = d.timestamp.toLocaleDateString();
        const time = d.timestamp.toLocaleTimeString();
        li.textContent = `${date}     ${time}`;
        timesList.appendChild(li);
    });

    const peakHourData = d3.rollup(
      filteredData.filter(d => d.status),
      v => v.length,
      d => d.timestamp.getHours()
    );

    const peakHour = Array.from(peakHourData).reduce((max, curr) => curr[1] > max[1] ? curr : max, [0, 0]);
    document.getElementById('peak-hour').textContent = `${peakHour[0]}:00 - ${peakHour[0] + 1}:00`;

    const quietHour = Array.from(peakHourData)
        .reduce((min, curr) => curr[1] < min[1] ? curr : min, [0, Infinity]);
    document.getElementById('quiet-hour').textContent = 
        `${quietHour[0]}:00 - ${quietHour[0] + 1}:00`;

    if (filteredData.filter(d => d.status).length >= 2) {
        const sortedActivations = filteredData
            .filter(d => d.status)
            .sort((a, b) => a.timestamp - b.timestamp);
        
        let totalIntervals = 0;
        for (let i = 1; i < sortedActivations.length; i++) {
            const interval = sortedActivations[i].timestamp - sortedActivations[i-1].timestamp;
            totalIntervals += interval;
        }
        const avgIntervalMinutes = Math.round(
            (totalIntervals / (sortedActivations.length - 1)) / (1000 * 60)
        );
        document.getElementById('avg-interval').textContent = avgIntervalMinutes;
    }

    const calculateTotalTime = (data) => {
        let totalTime = 0;
        let lastStatus = false;
        let lastTimestamp = null;
        
        // Ordenar los datos por timestamp
        const sortedData = [...data].sort((a, b) => a.timestamp - b.timestamp);
        
        sortedData.forEach(d => {
            if (d.status && !lastStatus) {
                // Se enciende
                lastTimestamp = d.timestamp;
            } else if (!d.status && lastStatus && lastTimestamp) {
                // Se apaga
                const interval = d.timestamp - lastTimestamp;
                if (interval > 0) { // Solo agregar intervalos positivos
                    totalTime += interval;
                }
            }
            lastStatus = d.status;
        });
        
        // Manejar el caso donde el último estado es encendido
        if (lastStatus && lastTimestamp) {
            const now = new Date();
            const interval = now - lastTimestamp;
            if (interval > 0) {
                totalTime += interval;
            }
        }
        
        return Math.max(0, Math.round(totalTime / (1000 * 60))); // Asegurar que nunca sea negativo
    };

    const totalTimeOn = calculateTotalTime(filteredData);
    document.getElementById('total-time').textContent = totalTimeOn;


    const activePercentage = ((totalTimeOn / (24 * 60)) * 100).toFixed(1);
    document.getElementById('active-percentage').textContent = activePercentage;


    const calculateLongestSequence = (data) => {
        let currentSequence = 0;
        let maxSequence = 0;
        
        data.forEach((d, i) => {
            if (d.status) {
                currentSequence++;
                maxSequence = Math.max(maxSequence, currentSequence);
            } else {
                currentSequence = 0;
            }
        });
        return maxSequence;
    };

    const longestSequence = calculateLongestSequence(filteredData);
    document.getElementById('longest-sequence').textContent = longestSequence;

  } catch (error) {
    console.error('Error fetching data:', error);
  }
};

const main = () => {
  window.onload = fetchDataAndRenderChart;
  document.getElementById('refresh-button').addEventListener('click', fetchDataAndRenderChart);
};

// Ejecutar la función principal
main();