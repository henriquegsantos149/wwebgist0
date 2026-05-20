// --- CONFIGURAÇÕES GERAIS ---
let map;
let layers = {}; // Armazena as referências das camadas carregadas
let sicarFeatures = []; // Armazena as features do SICAR para busca
let sicarLayer; // Referência direta para a camada do SICAR

// Elementos de UI
const loadingScreen = document.getElementById('loading-screen');
const progressBarFill = document.getElementById('progress-bar-fill');
const progressPercentage = document.getElementById('progress-percentage');

// --- 1. CONFIGURAÇÃO DOS MAPAS DE FUNDO (BASEMAPS) ---
const basemaps = {
    osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }),
    satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 18,
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
    }),
    dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 20,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    })
};

// --- 2. INICIALIZAÇÃO DO MAPA ---
function initMap() {
    // Configura o mapa com o renderizador CANVAS ativo para melhor performance
    map = L.map('map', {
        center: [-8.8, -64.2],
        zoom: 9,
        zoomControl: false, // Controle de zoom customizado no canto superior direito
        renderer: L.canvas() // CRÍTICO para lidar com milhares de feições sem lentidão
    });

    // Adiciona o basemap padrão
    basemaps.osm.addTo(map);
    
    // Adiciona controle de escala
    L.control.scale({ position: 'bottomleft', imperial: false }).addTo(map);

    // Reposiciona o controle de zoom para o canto superior direito
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Botão de Centralização Geral (Home Zoom)
    const HomeControl = L.Control.extend({
        options: { position: 'topright' },
        onAdd: function() {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
            const button = L.DomUtil.create('a', 'leaflet-control-home', container);
            button.innerHTML = '<i class="fa-solid fa-house"></i>';
            button.title = 'Centralizar no Município';
            button.href = '#';

            L.DomEvent.on(button, 'click', function(e) {
                L.DomEvent.stopPropagation(e);
                L.DomEvent.preventDefault(e);
                if (layers.boundary) {
                    map.fitBounds(layers.boundary.getBounds());
                } else {
                    map.setView([-8.8, -64.2], 9);
                }
            });
            return container;
        }
    });
    map.addControl(new HomeControl());

    // Botão de Localização do Usuário (Locate Me)
    const LocateControl = L.Control.extend({
        options: { position: 'topright' },
        onAdd: function() {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
            const button = L.DomUtil.create('a', 'leaflet-control-locate', container);
            button.innerHTML = '<i class="fa-solid fa-location-arrow"></i>';
            button.title = 'Minha Localização';
            button.href = '#';

            L.DomEvent.on(button, 'click', function(e) {
                L.DomEvent.stopPropagation(e);
                L.DomEvent.preventDefault(e);
                map.locate({ setView: true, maxZoom: 14 });
            });
            return container;
        }
    });
    map.addControl(new LocateControl());

    // Mensagem de sucesso ou erro na localização
    map.on('locationerror', function(e) {
        alert('Não foi possível obter sua localização: ' + e.message);
    });

    // Exibe coordenadas ao mover o mouse
    const coordsVal = document.getElementById('coords-val');
    map.on('mousemove', function(e) {
        const lat = e.latlng.lat.toFixed(5);
        const lng = e.latlng.lng.toFixed(5);
        coordsVal.textContent = `Lat: ${lat}, Lng: ${lng}`;
    });

    // Inicializa as ferramentas de medição (Leaflet Geoman)
    initMeasurementTools();
}

// --- 3. FERRAMENTAS DE MEDIÇÃO (GEOMAN) ---
function initMeasurementTools() {
    map.pm.addControls({
        position: 'topright',
        drawMarker: false,
        drawCircleMarker: false,
        drawPolyline: true,
        drawRectangle: true,
        drawPolygon: true,
        drawCircle: false,
        editMode: false,
        dragMode: false,
        cutPolygon: false,
        removalMode: true,
        oneBlock: true
    });

    // Textos do Geoman em Português
    map.pm.setLang('pt_br');

    const measureResult = document.getElementById('measure-result');
    const measureVal = document.getElementById('measure-val');

    // Ao começar a desenhar
    map.on('pm:drawstart', function() {
        measureResult.style.display = 'flex';
        measureVal.textContent = 'Desenhando...';
    });

    // Ao criar o desenho, calcula as medidas
    map.on('pm:create', function(e) {
        const layer = e.layer;
        let text = "";

        if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
            // Medir Linha (Comprimento)
            const latlngs = layer.getLatLngs();
            let distance = 0;
            for (let i = 0; i < latlngs.length - 1; i++) {
                distance += latlngs[i].distanceTo(latlngs[i+1]);
            }
            if (distance > 1000) {
                text = `Distância: ${(distance / 1000).toFixed(2)} km`;
            } else {
                text = `Distância: ${distance.toFixed(1)} m`;
            }
        } else if (layer instanceof L.Polygon) {
            // Medir Polígono (Área)
            const latlngs = layer.getLatLngs()[0];
            const area = L.GeometryUtil.geodesicArea(latlngs);
            if (area > 1000000) {
                text = `Área: ${(area / 1000000).toFixed(2)} km² (${(area / 10000).toFixed(1)} ha)`;
            } else {
                text = `Área: ${area.toFixed(1)} m²`;
            }
        }

        measureVal.textContent = text;
        
        // Mantém a medição ativa na barra de status. Se remover a feição, limpa.
        layer.on('remove', function() {
            measureResult.style.display = 'none';
        });
    });

    // Ao limpar/deletar feições desenhadas
    map.on('pm:remove', function() {
        measureResult.style.display = 'none';
    });
}

// --- 4. FUNÇÕES DE CARREGAMENTO E ATUALIZAÇÃO DO LOADING ---
let loadingProgress = 0;
const totalSteps = 6; // 5 Camadas + 1 Inicialização

function updateStepStatus(stepId, success = true) {
    const el = document.getElementById(stepId);
    if (el) {
        el.className = success ? 'completed' : 'error';
        const icon = el.querySelector('i');
        if (icon) {
            icon.className = success ? 'fa-solid fa-check' : 'fa-solid fa-circle-exclamation';
        }
    }
    
    // Atualiza a barra de progresso
    loadingProgress++;
    const percentage = Math.round((loadingProgress / totalSteps) * 100);
    progressBarFill.style.width = `${percentage}%`;
    progressPercentage.textContent = `${percentage}%`;

    // Se carregou tudo, oculta o loading screen
    if (loadingProgress >= totalSteps) {
        setTimeout(() => {
            loadingScreen.classList.add('fade-out');
            // Ajusta o zoom do mapa para o limite municipal
            if (layers.boundary) {
                map.fitBounds(layers.boundary.getBounds());
            }
        }, 600);
    }
}

// --- 5. FUNÇÕES DE ESTILIZAÇÃO E INTERAÇÃO DAS CAMADAS ---

// Estilo: Limite Municipal
const styleBoundary = () => ({
    color: '#ef4444', // Vermelho vivo
    weight: 3,
    dashArray: '6, 6',
    fillColor: '#ef4444',
    fillOpacity: 0.02,
    interactive: true
});

// Estilo: Rodovias Federais
const styleHighwaysFed = () => ({
    color: '#3b82f6', // Azul royal
    weight: 3.5,
    opacity: 0.9,
    lineCap: 'round',
    lineJoin: 'round'
});

// Estilo: Rodovias Estaduais
const styleHighwaysEst = () => ({
    color: '#f97316', // Laranja vibrante
    weight: 2.2,
    opacity: 0.8,
    lineCap: 'round',
    lineJoin: 'round'
});

// Estilo: Drenagem
const styleDrainage = () => ({
    color: '#06b6d4', // Ciano
    weight: 1.0,
    opacity: 0.7,
    lineCap: 'round',
    lineJoin: 'round'
});

// Estilo: Imóveis Rurais (SICAR)
const styleSICAR = (feature) => {
    const status = feature.properties.status_imo || '';
    let fillColor = '#8b5cf6'; // Roxo padrão (outros)
    let borderColor = '#6d28d9';

    if (status === 'AT') {
        fillColor = '#10b981'; // Verde (Ativo)
        borderColor = '#047857';
    } else if (status === 'PE') {
        fillColor = '#eab308'; // Amarelo (Pendente)
        borderColor = '#b45309';
    } else if (status === 'CA') {
        fillColor = '#ef4444'; // Vermelho (Cancelado)
        borderColor = '#b91c1c';
    } else if (status === 'SU') {
        fillColor = '#8b5cf6'; // Roxo (Suspenso)
        borderColor = '#6d28d9';
    }

    return {
        fillColor: fillColor,
        fillOpacity: 0.6,
        color: borderColor,
        weight: 0.5,
        opacity: 0.85
    };
};

// Configura popups de cada camada
function onEachFeature(layerName, feature, layer) {
    let popupContent = `<div class="webgis-popup">`;

    if (layerName === 'boundary') {
        popupContent += `
            <div class="webgis-popup-header">
                <h4>Município de Porto Velho</h4>
                <span>Limite Oficial IBGE</span>
            </div>
            <table class="webgis-popup-table">
                <tr><td class="label-td">Estado:</td><td class="val-td">${feature.properties.NM_UF || 'Rondônia'}</td></tr>
                <tr><td class="label-td">Região:</td><td class="val-td">${feature.properties.NM_REGIAO || 'Norte'}</td></tr>
                <tr><td class="label-td">Área Total:</td><td class="val-td">34.090,46 km²</td></tr>
                <tr><td class="label-td">Código Mun:</td><td class="val-td">${feature.properties.CD_MUN || '1100205'}</td></tr>
            </table>
        `;
    } else if (layerName === 'highways-fed' || layerName === 'highways-est') {
        const tipo = layerName === 'highways-fed' ? 'Federal (BR)' : 'Estadual (RO)';
        popupContent += `
            <div class="webgis-popup-header">
                <h4>Rodovia ${tipo}</h4>
                <span>Trecho DNIT</span>
            </div>
            <table class="webgis-popup-table">
                <tr><td class="label-td">Código Rod:</td><td class="val-td">${feature.properties.Codigo_Rod || 'N/D'}</td></tr>
                <tr><td class="label-td">Superfície:</td><td class="val-td">${feature.properties.Superficie === 'PAV' ? 'Pavimentada' : (feature.properties.Superficie === 'PLA' ? 'Planejada' : 'Terra/Outra')}</td></tr>
                <tr><td class="label-td">Início:</td><td class="val-td">${feature.properties.Local_Inic || 'N/D'}</td></tr>
                <tr><td class="label-td">Fim:</td><td class="val-td">${feature.properties.Local_Fim || 'N/D'}</td></tr>
                <tr><td class="label-td">Extensão:</td><td class="val-td">${feature.properties.Extensao ? feature.properties.Extensao.toFixed(2) + ' km' : 'N/D'}</td></tr>
            </table>
        `;
    } else if (layerName === 'drainage') {
        popupContent += `
            <div class="webgis-popup-header">
                <h4>Trecho de Drenagem</h4>
                <span>Base Hidrográfica ANA</span>
            </div>
            <table class="webgis-popup-table">
                <tr><td class="label-td">ID Trecho:</td><td class="val-td">${feature.properties.id || 'N/D'}</td></tr>
                <tr><td class="label-td">Município:</td><td class="val-td">Porto Velho / RO</td></tr>
                <tr><td class="label-td">Órgão Regulador:</td><td class="val-td">ANA</td></tr>
            </table>
        `;
    } else if (layerName === 'sicar') {
        const statusClass = feature.properties.status_imo === 'AT' ? 'at' : 'pe';
        const statusLabel = feature.properties.status_imo === 'AT' ? 'Ativo' : 'Pendente';
        popupContent += `
            <div class="webgis-popup-header">
                <h4>Imóvel Rural (CAR)</h4>
                <span class="status-badge ${statusClass}">${statusLabel}</span>
            </div>
            <table class="webgis-popup-table">
                <tr><td class="label-td" style="font-size:0.68rem;">Código CAR:</td><td class="val-td" style="font-size:0.68rem; word-break:break-all;">${feature.properties.cod_imovel}</td></tr>
                <tr><td class="label-td">Módulos Fiscais:</td><td class="val-td">${feature.properties.modulos_ru || 0}</td></tr>
                <tr><td class="label-td">Área Declarada:</td><td class="val-td">${feature.properties.sobreposi3 ? feature.properties.sobreposi3.toFixed(2) + ' ha' : 'N/D'}</td></tr>
                <tr><td class="label-td">Situação:</td><td class="val-td" style="font-size:0.7rem; line-height: 1.1;">${feature.properties.situacao_a}</td></tr>
            </table>
        `;
    }

    popupContent += `</div>`;
    layer.bindPopup(popupContent, { maxWidth: 300 });

    // Armazena referência ao elemento da camada para busca no CAR
    if (layerName === 'sicar' && feature.properties.cod_imovel) {
        feature.layerRef = layer; 
    }
}

// --- 6. FILA SEQUENCIAL DE CARREGAMENTO DAS CAMADAS ---
async function loadLayers() {
    try {
        // Passo 1: Limite Municipal
        let res = await fetch('./portovelho_ro.geojson');
        let data = await res.json();
        layers.boundary = L.geoJSON(data, {
            style: styleBoundary,
            onEachFeature: (f, l) => onEachFeature('boundary', f, l)
        });
        if (document.getElementById('chk-boundary').checked) {
            layers.boundary.addTo(map);
        }
        updateStepStatus('step-boundary');

        // Passo 2: Rodovias Estaduais
        res = await fetch('./rodovias_estaduais_PortoVelho_DNIT.geojson');
        data = await res.json();
        layers.highwaysEst = L.geoJSON(data, {
            style: styleHighwaysEst,
            onEachFeature: (f, l) => onEachFeature('highways-est', f, l)
        });
        if (document.getElementById('chk-highways-est').checked) {
            layers.highwaysEst.addTo(map);
        }
        updateStepStatus('step-highways-est');

        // Passo 3: Rodovias Federais
        res = await fetch('./rodovias_federais_PortoVelho_DNIT.geojson');
        data = await res.json();
        layers.highwaysFed = L.geoJSON(data, {
            style: styleHighwaysFed,
            onEachFeature: (f, l) => onEachFeature('highways-fed', f, l)
        });
        if (document.getElementById('chk-highways-fed').checked) {
            layers.highwaysFed.addTo(map);
        }
        updateStepStatus('step-highways-fed');

        // Passo 4: Trechos de Drenagem (13.1 MB)
        res = await fetch('./trechos_Drenagem_ANA_AI_PortoVelho.geojson');
        data = await res.json();
        layers.drainage = L.geoJSON(data, {
            style: styleDrainage,
            onEachFeature: (f, l) => onEachFeature('drainage', f, l)
        });
        if (document.getElementById('chk-drainage').checked) {
            layers.drainage.addTo(map);
        }
        updateStepStatus('step-drainage');

        // Passo 5: Imóveis Rurais SICAR (19.5 MB)
        res = await fetch('./imoveis_rurais_SICAR_portovelho_ro.geojson');
        data = await res.json();
        
        // Salva as feições na memória global para busca rápida
        sicarFeatures = data.features;
        
        sicarLayer = L.geoJSON(data, {
            style: styleSICAR,
            onEachFeature: (f, l) => onEachFeature('sicar', f, l)
        });
        layers.sicar = sicarLayer;
        if (document.getElementById('chk-sicar').checked) {
            layers.sicar.addTo(map);
        }
        updateStepStatus('step-sicar');

        // Passo 6: Computar Estatísticas e Gráfico
        computeStatistics();
        updateStepStatus('step-map');

    } catch (err) {
        console.error('Erro ao carregar dados geoespaciais:', err);
        alert('Erro ao carregar arquivos do WebGIS. Verifique se o servidor local está ativo.');
    }
}

// --- 7. PROCESSAMENTO E ESTATÍSTICAS ---
let statusChart = null;

function computeStatistics() {
    // 1. Drenagem
    let drainageCount = 0;
    if (layers.drainage) {
        drainageCount = layers.drainage.getLayers().length;
        document.getElementById('stats-count-rivers').textContent = `${drainageCount.toLocaleString()} trechos`;
    }

    // 2. Rodovias Federais
    let totalLenFed = 0;
    if (layers.highwaysFed) {
        layers.highwaysFed.eachLayer(l => {
            if (l.feature.properties.Extensao) {
                totalLenFed += l.feature.properties.Extensao;
            }
        });
        document.getElementById('stats-len-fed').textContent = `${totalLenFed.toFixed(1)} km`;
    }

    // 3. Rodovias Estaduais
    let totalLenEst = 0;
    if (layers.highwaysEst) {
        layers.highwaysEst.eachLayer(l => {
            if (l.feature.properties.Extensao) {
                totalLenEst += l.feature.properties.Extensao;
            }
        });
        document.getElementById('stats-len-est').textContent = `${totalLenEst.toFixed(1)} km`;
    }

    // 4. SICAR (Imóveis Rurais)
    let totalArea = 0;
    let statusCounts = { AT: 0, PE: 0, Outros: 0 };

    sicarFeatures.forEach(feature => {
        const area = feature.properties.sobreposi3 || 0;
        totalArea += area;

        const status = feature.properties.status_imo;
        if (status === 'AT') statusCounts.AT++;
        else if (status === 'PE') statusCounts.PE++;
        else statusCounts.Outros++;
    });

    document.getElementById('stats-total-car').textContent = sicarFeatures.length.toLocaleString();
    
    // Converte área de Hectares para Quilômetros Quadrados caso seja muito grande
    if (totalArea > 1000000) {
        document.getElementById('stats-area-total').textContent = `${(totalArea / 1000000).toFixed(2)} M ha`;
    } else {
        document.getElementById('stats-area-total').textContent = `${Math.round(totalArea).toLocaleString()} ha`;
    }

    // Inicializa o Gráfico Analítico (Chart.js)
    initStatusChart(statusCounts);
}

function initStatusChart(statusData) {
    const ctx = document.getElementById('chart-sicar-status').getContext('2d');
    
    // Destrói gráfico antigo se existir (para quando filtrar e atualizar)
    if (statusChart) {
        statusChart.destroy();
    }

    statusChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Ativo (AT)', 'Pendente (PE)', 'Outros'],
            datasets: [{
                data: [statusData.AT, statusData.PE, statusData.Outros],
                backgroundColor: ['#22c55e', '#eab308', '#a855f7'],
                borderColor: 'rgba(15, 23, 42, 0.95)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: '#94a3b8',
                        font: { size: 9, family: 'Montserrat', weight: '600' },
                        boxWidth: 8,
                        padding: 10
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(8, 12, 24, 0.95)',
                    titleColor: '#ffffff',
                    titleFont: { family: 'Montserrat', size: 11, weight: '700' },
                    bodyColor: '#cbd5e1',
                    bodyFont: { family: 'Montserrat', size: 11 },
                    borderColor: 'rgba(255, 255, 255, 0.08)',
                    borderWidth: 1,
                    padding: 10,
                    boxWidth: 8,
                    boxPadding: 4,
                    usePointStyle: true
                }
            },
            cutout: '70%'
        }
    });
}

// --- 8. GERENCIAMENTO DE INTERFACE E EVENTOS ---

function setupUIEventListeners() {
    // Alternar visibilidade da Sidebar (Collapse/Expand)
    const toggleSidebarBtn = document.getElementById('toggle-sidebar');
    const appContainer = document.getElementById('app-container');
    
    toggleSidebarBtn.addEventListener('click', () => {
        appContainer.classList.toggle('sidebar-collapsed');
        appContainer.classList.toggle('sidebar-expanded');
        
        // Redimensiona o mapa após o painel fechar/abrir para ajustar as tiles
        setTimeout(() => {
            map.invalidateSize();
        }, 400);
    });

    // Seletor de Mapas de Fundo (Basemaps)
    const basemapCards = document.querySelectorAll('.basemap-card');
    basemapCards.forEach(card => {
        card.addEventListener('click', function() {
            // Remove classe ativa de todos e adiciona no clicado
            basemapCards.forEach(c => c.classList.remove('active'));
            this.classList.add('active');

            const basemapVal = this.getAttribute('data-basemap');
            
            // Remove basemaps atuais do mapa
            Object.values(basemaps).forEach(layer => map.removeLayer(layer));
            
            // Adiciona o novo basemap selecionado
            basemaps[basemapVal].addTo(map);
        });
    });

    // Toggle de Camadas (Checkboxes) e Destaque Visual (active state)
    const toggleLayer = (chkId, layerKey) => {
        const chk = document.getElementById(chkId);
        if (!chk) return;
        const layerItem = chk.closest('.layer-item');
        
        // Sincroniza estado ativo inicial
        if (chk.checked) {
            layerItem.classList.add('active');
        } else {
            layerItem.classList.remove('active');
        }

        chk.addEventListener('change', function() {
            const layerObj = layers[layerKey];
            if (this.checked) {
                if (layerObj) layerObj.addTo(map);
                layerItem.classList.add('active');
            } else {
                if (layerObj) map.removeLayer(layerObj);
                layerItem.classList.remove('active');
            }
        });
    };

    // Associa eventos de liga/desliga imediatamente
    toggleLayer('chk-boundary', 'boundary');
    toggleLayer('chk-highways-fed', 'highwaysFed');
    toggleLayer('chk-highways-est', 'highwaysEst');
    toggleLayer('chk-drainage', 'drainage');
    toggleLayer('chk-sicar', 'sicar');

    // Ajuste de Opacidade de Camadas (Sliders)
    const setupOpacitySlider = (sliderId, layerKey) => {
        const slider = document.getElementById(sliderId);
        if (!slider) return;
        slider.addEventListener('input', function() {
            const val = parseFloat(this.value);
            const layerObj = layers[layerKey];
            if (layerObj && typeof layerObj.setStyle === 'function') {
                layerObj.setStyle({ opacity: val, fillOpacity: val * 0.6 });
            }
        });
    };

    // Associa eventos dos sliders imediatamente
    setupOpacitySlider('op-boundary', 'boundary');
    setupOpacitySlider('op-highways-fed', 'highwaysFed');
    setupOpacitySlider('op-highways-est', 'highwaysEst');
    setupOpacitySlider('op-drainage', 'drainage');
    setupOpacitySlider('op-sicar', 'sicar');

    // Toggle da Gaveta da Legenda do CAR
    const legendBtn = document.getElementById('btn-toggle-legend-sicar');
    const legendDetail = document.getElementById('legend-detail-sicar');
    
    legendBtn.addEventListener('click', () => {
        legendBtn.classList.toggle('rotated');
        if (legendDetail.style.display === 'grid') {
            legendDetail.style.display = 'none';
        } else {
            legendDetail.style.display = 'grid';
        }
    });

    // Filtro por Situação Cadastral
    document.getElementById('filter-status').addEventListener('change', function() {
        const val = this.value;
        if (!sicarLayer) return;

        sicarLayer.filter((feature) => {
            if (val === 'all') return true;
            if (val === 'ativo') return feature.properties.status_imo === 'AT';
            if (val === 'pendente') return feature.properties.status_imo === 'PE';
            return true;
        });

        // Recalcular gráfico e contadores com base no filtro
        let filteredFeatures = sicarFeatures.filter(f => {
            if (val === 'all') return true;
            if (val === 'ativo') return f.properties.status_imo === 'AT';
            if (val === 'pendente') return f.properties.status_imo === 'PE';
            return true;
        });

        // Atualizar estatísticas na tela
        let totalArea = 0;
        let statusCounts = { AT: 0, PE: 0, Outros: 0 };
        filteredFeatures.forEach(feature => {
            totalArea += feature.properties.sobreposi3 || 0;
            const status = feature.properties.status_imo;
            if (status === 'AT') statusCounts.AT++;
            else if (status === 'PE') statusCounts.PE++;
            else statusCounts.Outros++;
        });

        document.getElementById('stats-total-car').textContent = filteredFeatures.length.toLocaleString();
        document.getElementById('stats-area-total').textContent = `${Math.round(totalArea).toLocaleString()} ha`;
        
        // Atualizar gráfico
        initStatusChart(statusCounts);
    });

    // --- 9. BUSCA E AUTO-COMPLETA CAR ---
    const searchInput = document.getElementById('search-car');
    const suggestionsPanel = document.getElementById('search-suggestions');
    const clearSearchBtn = document.getElementById('btn-clear-search');

    searchInput.addEventListener('input', function() {
        const query = this.value.toUpperCase().trim();
        suggestionsPanel.innerHTML = '';

        if (query.length < 3) {
            suggestionsPanel.style.display = 'none';
            clearSearchBtn.style.display = 'none';
            return;
        }

        clearSearchBtn.style.display = 'block';

        // Filtra imóveis que contêm o código buscado
        const matches = sicarFeatures.filter(f => f.properties.cod_imovel && f.properties.cod_imovel.includes(query)).slice(0, 10);

        if (matches.length === 0) {
            const el = document.createElement('div');
            el.className = 'suggestion-item';
            el.textContent = 'Nenhum imóvel encontrado';
            suggestionsPanel.appendChild(el);
        } else {
            matches.forEach(match => {
                const el = document.createElement('div');
                el.className = 'suggestion-item';
                // Mostra os últimos 20 caracteres do código CAR para facilitar visualização
                el.textContent = '...' + match.properties.cod_imovel.slice(-25);
                el.title = match.properties.cod_imovel;
                
                el.addEventListener('click', () => {
                    searchInput.value = match.properties.cod_imovel;
                    suggestionsPanel.style.display = 'none';
                    zoomToCAR(match.properties.cod_imovel);
                });
                
                suggestionsPanel.appendChild(el);
            });
        }

        suggestionsPanel.style.display = 'flex';
    });

    // Limpar Busca
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        suggestionsPanel.style.display = 'none';
        clearSearchBtn.style.display = 'none';
    });

    // Fecha sugestões ao clicar fora
    document.addEventListener('click', (e) => {
        if (e.target !== searchInput && e.target !== suggestionsPanel) {
            suggestionsPanel.style.display = 'none';
        }
    });
}

// Foca e aproxima o mapa no imóvel CAR selecionado
function zoomToCAR(codImovel) {
    if (!sicarLayer) return;

    let targetLayer = null;
    
    // Procura o objeto correspondente nas subcamadas do Leaflet
    sicarLayer.eachLayer(l => {
        if (l.feature.properties.cod_imovel === codImovel) {
            targetLayer = l;
        }
    });

    if (targetLayer) {
        // Liga a camada do CAR se estiver desmarcada
        const chkSicar = document.getElementById('chk-sicar');
        if (!chkSicar.checked) {
            chkSicar.checked = true;
            sicarLayer.addTo(map);
        }

        // Foca o mapa
        map.fitBounds(targetLayer.getBounds(), { padding: [50, 50], maxZoom: 15 });
        
        // Abre o popup do imóvel correspondente
        setTimeout(() => {
            targetLayer.openPopup();
        }, 300);
    } else {
        alert('Imóvel encontrado no banco, mas não renderizado no mapa. Verifique se os filtros estão ativos.');
    }
}

// --- 10. INICIALIZAÇÃO INICIAL ---
window.addEventListener('DOMContentLoaded', () => {
    initMap();
    setupUIEventListeners();
    loadLayers();
});
