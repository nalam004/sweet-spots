const apiKey = "AAPKf3c7596b921c4f4ba2b0e154a06df0cezPiZRCtAZHP5l0ClIf_nW0s-BCgd0q1drCVC0JAcduiwUv_DoOyTVY4OlkCs7Nl6";
const authentication = arcgisRest.ApiKeyManager.fromKey(apiKey);
let bounds = new mapboxgl.LngLatBounds();
const basemapEnum = "ArcGIS:Navigation";
let coordinates;
let map;
let popup;

if ("geolocation" in navigator) { 
    navigator.geolocation.getCurrentPosition(position => { 
        coordinates = [position.coords.longitude, position.coords.latitude];

        map = new mapboxgl.Map({
            container: "map",
            style: `https://basemaps-api.arcgis.com/arcgis/rest/services/styles/${basemapEnum}?type=style&token=${apiKey}`,
            center: coordinates,
            zoom: 13
        });

        map.once("load", () => { 
            // load marker image and user icon image
            map.loadImage('https://cdn-icons-png.flaticon.com/512/619/619483.png', (error, image) => {
                if (error) throw error;
                map.addImage('cupcake', image);
            })

            map.loadImage('https://cdn.emojidex.com/emoji/seal/yum%28pudding%29.png?1455290868', (error, image) => {
                if (error) throw error;
                map.addImage('user-icon', image);
            })

            // add user location to map
            map.addSource('user', {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: [{
                        type: 'Feature',
                        geometry: {
                            type: 'Point',
                            coordinates: coordinates
                        }
                    }]
                }
            });

            map.addLayer({
                id: "user-marker",
                source: "user",
                type: "symbol",
                layout: {
                    'icon-image': 'user-icon', 
                    'icon-size': 0.1
                }
            });
            
            // add places markers to map
            map.addSource("places", {
                type: "geojson",
                data: {
                    type: "FeatureCollection",
                    features: []
                }
            });

            map.addLayer({
                id: "markers",
                source: "places",
                type: 'symbol',
                layout: {
                    'icon-image': 'cupcake', 
                    'icon-size': 0.05
                }
            });

            map.on("mouseenter", "markers", (e) => {
                const place = e.features[0];
                popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false })
                                .setHTML(`<b>${place.properties.PlaceName}</b>`)
                                .setLngLat(place.geometry.coordinates)
                                .addTo(map);
            });
            
            map.on("mouseleave", "markers", () => {
                popup.remove();
            });

            map.on("click", "markers", (e) => {
                const place = e.features[0];
                let start = coordinates;
                let end = place.geometry.coordinates;
                updateRoute(start, end);
            });

            showPlaces();
            addRouteLayer();
        });
    }); 
} else { console.log("geolocation IS NOT availabe"); }

function showPlaces() {
    const category = "bakery";
    if (!category) { return; }
    
    arcgisRest.geocode({
        authentication,
        outFields: "Place_addr,PlaceName",
        
        params: {
            category,
            location: map.getCenter().toArray().join(","),
            maxLocations: 20
        }
    }).then((response) => {
        map.getSource("places").setData(response.geoJson);
        listBakeries(response.geoJson.features);
    }).catch((error) => { alert("There was a problem using the geocoder. See the console for details."); });
}

function listBakeries(bakeries) {
    let list = document.getElementById("bakeries");

    bakeries.forEach(bakery => {
        bounds.extend(bakery.geometry.coordinates);
        let name = document.createElement('p');
        name.innerHTML = bakery.properties.PlaceName;
        list.appendChild(name);
    })

    map.fitBounds(bounds);
}

function addRouteLayer() {
    map.addSource("route", {
        type: "geojson",
        data: {
            type: "FeatureCollection",
            features: []
        }
    });

    map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",

        paint: {
            "line-color": "#ff69af",
            "line-width": 4
        }
    });
}

function updateRoute(start, end) {
    arcgisRest.solveRoute({
        stops: [start, end],
        endpoint: "https://route-api.arcgis.com/arcgis/rest/services/World/Route/NAServer/Route_World/solve",
        authentication
    }).then((response) => {
        map.getSource("route").setData(response.routes.geoJson);
    }).catch((error) => { alert("There was a problem using the route service. See the console for details."); });
}