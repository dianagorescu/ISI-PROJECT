import {
    Component,
    OnInit,
    ViewChild,
    ElementRef,
    Output,
    EventEmitter,
    OnDestroy
} from "@angular/core";

import esri = __esri; // Esri TypeScript Types

import Polyline from '@arcgis/core/geometry/Polyline';
import Polygon from '@arcgis/core/geometry/Polygon';

import Config from '@arcgis/core/config';
import WebMap from '@arcgis/core/WebMap';
import MapView from '@arcgis/core/views/MapView';
import * as locator from '@arcgis/core/rest/locator';
import Bookmarks from '@arcgis/core/widgets/Bookmarks';
import Expand from '@arcgis/core/widgets/Expand';
import Geolocation from '@arcgis/core/widgets/Locate';


import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import Graphic from '@arcgis/core/Graphic';
import Point from '@arcgis/core/geometry/Point';

import FeatureLayer from '@arcgis/core/layers/FeatureLayer';

import FeatureSet from '@arcgis/core/rest/support/FeatureSet';
import RouteParameters from '@arcgis/core/rest/support/RouteParameters';
import * as route from "@arcgis/core/rest/route.js";

import Search from "@arcgis/core/widgets/Search";

import { Subscription } from "rxjs";
import { FirebaseService, IDatabaseItem } from "src/app/services/firebase";
import { SuperheroFactoryService } from "src/app/services/superhero-factory";
import * as reactiveUtils from '@arcgis/core/core/reactiveUtils';

@Component({
    selector: "app-esri-map",
    templateUrl: "./esri-map.component.html",
    styleUrls: ["./esri-map.component.scss"]
})
export class EsriMapComponent implements OnInit, OnDestroy {
    @Output() mapLoadedEvent = new EventEmitter<boolean>();

    @ViewChild("mapViewNode", { static: true }) private mapViewEl: ElementRef;

    map: esri.Map;
    view: esri.MapView;
    graphicsLayer: esri.GraphicsLayer;
    graphicsLayerRoutes: esri.GraphicsLayer;
    trailheadsLayer: esri.FeatureLayer;
    graphicsLayerUserPoints: esri.GraphicsLayer;
    graphicsLayerStaticPoints: esri.GraphicsLayer;
    locator: esri.locator;
    reactiveUtils: esri.reactiveUtils;

    zoom = 6;
    center: Array<number> = [24, 46.07817583063242];
    basemap = "streets-vector";
    loaded = false;
    directionsElement: any;
    

    // constructor() { }
    

    isConnected: boolean = false;
    subscriptionList: Subscription;
    subscriptionObj: Subscription;

    listItems: IDatabaseItem[] = [];

    constructor(
        private fbs: FirebaseService,
        private sfs: SuperheroFactoryService
    ) {

    }

    

    ngOnInit() {
        try {
            this.initializeMap().then(() => {
                this.loaded = this.view.ready;
                this.mapLoadedEvent.emit(true);

                // Conectează la Firebase și afișează datele pe hartă
                this.connectFirebase();
                this.displayFirebaseDataOnMap();

                this.fetchLocations();

                // Obținerea cabinetelor veterinare din Google Places API
                //this.fetchVeterinaryLocationsFromAPI();
            });
        } catch (error) {
            console.error("Error loading the map: ", error);
            alert("Error loading the map");
        }
    }
    filtrarea(){
        const places = ["Choose a place type...", "Parks and Outdoors", "Coffee shop", "Gas station", "Food", "Hotel"];
        const select = document.createElement("select");
        select.setAttribute("class", "esri-widget esri-select");
        select.setAttribute("style", "width: 175px; font-family: 'Avenir Next W00'; font-size: 1em");

        places.forEach((p) => {
            const option = document.createElement("option");
            option.value = p;
            option.innerHTML = p;
            select.appendChild(option);
          });
        this.view.ui.add(select, "top-right");
        const locatorUrl = "http://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer";
    
        function findPlaces(category, pt) {
            this.locator
              .addressToLocations(locatorUrl, {location: pt, categories: [category],maxLocations: 25,outFields: ["Place_addr", "PlaceName"]})
  
              .then((results) => {
                this.view.closePopup();
                this.view.graphics.removeAll();

                const pointSymbol2 = {
                    type: "simple-marker",
                    color: [97, 255, 255],   // Mov pentru punctele statice
                    outline: { color: [255, 255, 255], width: 2 } // Contur alb
                };

                results.forEach((result) => {
                    this.view.graphics.add(
                      new Graphic({
                        attributes: result.attributes, // Data attributes returned
                        geometry: result.location, // Point returned
                        symbol: pointSymbol2,
    
                        popupTemplate: {
                          title: "{PlaceName}", // Data attribute names
                          content: "{Place_addr}"
                        }
                      })
                    );
                  });
              });
          }
          reactiveUtils.when(
            () => this.view.stationary,
            () => {
              findPlaces(select.value, this.view.center);
            }
          );

          select.addEventListener("change", (event) => {
            const target = event.target as HTMLSelectElement;
            findPlaces(target.value, this.view.center);
          });
    }

    connectFirebase() {
        if (this.isConnected) {
            return;
        }
        this.isConnected = true;
        this.fbs.connectToDatabase();
        this.subscriptionList = this.fbs.getChangeFeedList().subscribe((items: IDatabaseItem[]) => {
            console.log("list updated: ", items);
            this.listItems = items;
        });
        this.subscriptionObj = this.fbs.getChangeFeedObject().subscribe((stat: IDatabaseItem) => {
            console.log("object updated: ", stat);
        });
    }

    addListItem() {
        let newItemValue: string = Math.floor(Math.random() * 100).toString();
        newItemValue = this.sfs.getName();
        this.fbs.addSimpleListObject(newItemValue);
    }

    removeItems() {
        this.fbs.removeListItems();
    }

    disconnectFirebase() {
        if (this.subscriptionList != null) {
            this.subscriptionList.unsubscribe();
        }
        if (this.subscriptionObj != null) {
            this.subscriptionObj.unsubscribe();
        }
    }

    async fetchVeterinaryLocationsFromAPI() {

        const url = 'https://overpass-api.de/api/interpreter?data=[out:json][timeout:600];area["ISO3166-1"="RO"]->.searchArea;(node["amenity"="veterinary"](area.searchArea););out body;';
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('HTTP error! status: ${response.status}');
        }
        const data = await response.json();

        console.log("Fetched data:", data);
        //let count = 0;
        data.elements.forEach(place => {
            //count++;
            // Preia coordonatele necesare
            const latitude = place.lat;
            const longitude = place.lon;
            const Nume = place.tags?.name || 'N/A';
            const Program = place.tags?.opening_hours || 'N/A';
            const Localitate = place.tags["addr:city"] ? place.tags["addr:city"] : 'N/A';
            const Strada = place.tags["addr:street"] ? place.tags["addr:street"] : 'N/A';
            const Numar = place.tags["addr:housenumber"] ? place.tags["addr:housenumber"] : 'N/A';
            const Telefon = place.tags?.phone || 'N/A';
            const Site = place.tags?.website || 'N/A';
            const Email = place.tags?.email || 'N/A';


            //console.log("Fetched nume:", Nume);

    
            // Adaugă coordonatele în Firebase
            this.addPointToFirebase(latitude, longitude,
                Nume, Strada, Numar,
                Localitate, Program,
                Telefon, Site,
                Email);
        });
        //console.log(`Processed ${count} entries.`);
        //console.log(results);
    } catch (error) {
        console.error("Error fetching data:", error);
    }
        }
    // *********************************************

    addPointToFirebase(lat: number, lng: number, Nume: string, Strada: string,
        Numar: string, Localitate: string, Program: string, Telefon: string,
        Site: string, Email: string) {
        // Salvăm coordonatele punctului în Firebase
        this.fbs.addListObject({ Strada: Strada, Numar: Numar, Email: Email,
            Localitate: Localitate,
            Nume: Nume, Program: Program,
            Site: Site, Telefon: Telefon,
            latitude: lat, longitude: lng});
    }


    displayFirebaseDataOnMap() {
        // Afișează toate punctele din `mapPoints`
        this.subscriptionList = this.fbs.getMapPoints().subscribe((items: any[]) => {
            // Elimină doar punctele statice pentru a evita dublările
            this.graphicsLayerStaticPoints.removeAll();

            // Adaugă fiecare punct static din Firebase pe hartă
            items.forEach(item => {
                if (item.latitude != null && item.longitude != null) {
                    const point = new Point({
                        longitude: item.longitude,
                        latitude: item.latitude
                    });

                    const pointSymbol = {
                        type: "simple-marker",
                        color: [97, 17, 255],   // Mov pentru punctele statice
                        outline: { color: [255, 255, 255], width: 1 } // Contur alb
                    };

                    const pointGraphic = new Graphic({
                        geometry: point,
                        symbol: pointSymbol
                    });
                    this.graphicsLayerStaticPoints.add(pointGraphic);
                }
            });
            console.log("Punctele statice din Firebase afișate pe hartă:", items);
        });

        // Afișează coordonatele utilizatorului în timp real
        this.subscriptionObj = this.fbs.getUserPosition().subscribe((position: any) => {
            if (position && position.latitude != null && position.longitude != null) {
                const userPoint = new Point({
                    longitude: position.longitude,
                    latitude: position.latitude
                });

                const userSymbol = {
                    type: "simple-marker",
                    color: [0, 120, 255], // Albastru pentru poziția utilizatorului
                    outline: { color: [255, 255, 255], width: 1 } // Contur alb
                };

                const userGraphic = new Graphic({
                    geometry: userPoint,
                    symbol: userSymbol
                });

                // Elimină și actualizează doar punctul utilizatorului
                this.graphicsLayerUserPoints.removeAll();
                this.graphicsLayerUserPoints.add(userGraphic);
                console.log("Coordonatele utilizatorului afișate pe hartă:", position);
            }
        });
    }

    // *********************************************
    async initializeMap() {
        try {
            Config.apiKey = "AAPTxy8BH1VEsoebNVZXo8HurGZnrO0aYjmZ_npt39dGgIyZUAxtLIFy4jO4rcFTpRiXKEPtdLox0sphDby4Pf6e2cRTjkx4O1rJxzaNe2YUaFVX2pdMvvHDgd4tIg0woOjnsR6dSr-4xVUMpUT5VNKBkHNGxwIbrBHoj_sbQRQcttaQd5yruV7KX0UiWKR20TjstcDwmL8_fcY2n81h6AgLfTiNIlCEaWHJy7B7cYmfHV0.AT1_z3CHMbib";

            const mapProperties: esri.WebMapProperties = {
                basemap: this.basemap
            };
            this.map = new WebMap(mapProperties);

            this.addFeatureLayers();
            this.addGraphicsLayer();

            const mapViewProperties = {
                container: this.mapViewEl.nativeElement,
                center: this.center,
                zoom: this.zoom,
                map: this.map
            };
            this.view = new MapView(mapViewProperties);
            // Adăugăm widgetul de Geolocalizare
            const geoLocate = new Geolocation({
                view: this.view, // Harta pe care se va adăuga widgetul
                useHeadingEnabled: false, // Nu vom folosi direcția de deplasare (dacă este disponibilă)
                goToLocationEnabled: true, // Harta se va mișca pentru a arăta locația curentă
            });

            this.view.ui.add(geoLocate, "top-left"); // Adăugăm widgetul în colțul stânga sus

        

            // Adaugă evenimentul de clic pentru a adăuga un punct
            // this.view.on("click", (event) => {
            //     const point = this.view.toMap({ x: event.x, y: event.y });
            //     if (point) {
            //         // Adaugă punctul în Firebase și pe hartă
            //         this.addPointToFirebase(point.latitude, point.longitude);
            //     }
            // });
            
            await this.view.when();
            console.log("ArcGIS map loaded");
            this.addRoutingFromGeolocationToPoint();
            this.addSearchWidget();
            //this.filtrarea();


            return this.view;

            

        } catch (error) {
            console.error("Error loading the map: ", error);
            alert("Error loading the map");
        }
    }

    addSearchWidget() {
        const searchWidget = new Search({
            view: this.view
        });
        this.view.ui.add(searchWidget, "top-right");
    }

    addFeatureLayers() {
        // Creez stratul de drumuri
        this.trailheadsLayer = new FeatureLayer({
            url: "https://services1.arcgis.com/equSgvG6lh32w77K/arcgis/rest/services/Romania1000k/FeatureServer/9/query?where=1%3D1&outFields=*&outSR=4326&f=json",
            outFields: ['*'], // Selectez toate câmpurile disponibile
            popupTemplate: {
                title: "Detalii Județ",
                content: `
                    <b>Nume:</b> {NUME}<br>
                    <b>Municipiu:</b> {CAPITALA}<br>
                    <b>Suprafața:</b> {S_KM2}<br>
                    <b>Orașe:</b> {NR_URBAN}<br>
                    <b>Comune:</b> {NR_RURAL}<br>
                    <b>Populație:</b> {POP92}
                `
            }
        });
            // Adaug stratul pe hartă
    this.map.add(this.trailheadsLayer);
    console.log("Layer adăugat.");
}
    

    addGraphicsLayer() {
        this.graphicsLayer = new GraphicsLayer();
        this.map.add(this.graphicsLayer);
        this.graphicsLayerRoutes = new GraphicsLayer();
        this.map.add(this.graphicsLayerRoutes);
        this.graphicsLayerStaticPoints = new GraphicsLayer();
        this.map.add(this.graphicsLayerStaticPoints);
        this.graphicsLayerUserPoints = new GraphicsLayer();
        this.map.add(this.graphicsLayerUserPoints);
    }



    addPoint(lat: number, lng: number) {
        let point = new Point({
            longitude: lng,
            latitude: lat
        });

        const simpleMarkerSymbol = {
            type: "simple-marker",
            color: [226, 119, 40],  // Orange
            outline: {
                color: [255, 255, 255], // White
                width: 1
            }
        };

        let pointGraphic: esri.Graphic = new Graphic({
            geometry: point,
            symbol: simpleMarkerSymbol
        });

        this.graphicsLayerUserPoints.add(pointGraphic);
    }

    removePoints() {
        this.graphicsLayerUserPoints.removeAll();
    }

    removeRoutes() {
        this.graphicsLayerRoutes.removeAll();
    }

    clearRouter() {
        if (this.view) {
            // Remove all graphics related to routes
            this.removeRoutes();
            this.removePoints();
            console.log("Route cleared");
            this.view.ui.remove(this.directionsElement);
            this.view.ui.empty("top-right");
            console.log("Directions cleared");
        }
    }

    addRoutingFromGeolocationToPoint() {
        const routeUrl = "https://route-api.arcgis.com/arcgis/rest/services/World/Route/NAServer/Route_World";
      
        // Obține locația curentă
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const userLatitude = position.coords.latitude;
                    const userLongitude = position.coords.longitude;
    
                    // Adaugă locația utilizatorului pe hartă
                    const userPoint = new Point({
                        latitude: userLatitude,
                        longitude: userLongitude
                    });
    
                    const userSymbol = {
                        type: "simple-marker",
                        color: [0, 120, 255], // Albastru
                        outline: { color: [255, 255, 255], width: 1 } // Contur alb
                    };
    
                    const userGraphic = new Graphic({
                        geometry: userPoint,
                        symbol: userSymbol
                    });
    
                    this.graphicsLayerUserPoints.removeAll();
                    this.graphicsLayerUserPoints.add(userGraphic);
    
                    console.log("Locația curentă adăugată:", { userLatitude, userLongitude });

                    let redPointGraphic: esri.Graphic = null;  // Variabilă pentru a păstra punctul roșu
    
                    // Ascultă evenimentul de clic pe hartă
                    this.view.on("click", (event) => {
                        // Conversia coordonatelor ecranului în coordonate ale hărții
                        const clickedPoint = this.view.toMap({ x: event.x, y: event.y });
                        console.log("Punct clicat:", clickedPoint.latitude, clickedPoint.longitude);
    
                        if (clickedPoint) {
                            console.log("Coordonatele punctului selectat:", clickedPoint);

                            // Dacă există un punct roșu anterior, elimină-l
                            if (redPointGraphic) {
                                this.graphicsLayerUserPoints.remove(redPointGraphic);
                            }
    
                            // Adaugă punctul selectat pe hartă
                            const clickedSymbol = {
                                type: "simple-marker",
                                color: [255, 0, 0], // Roșu
                                outline: { color: [255, 255, 255], width: 1 } // Contur alb
                            };

                            redPointGraphic = new Graphic({
                                geometry: clickedPoint,
                                symbol: clickedSymbol
                            });
                            
    
                            // Adaugă graficul în strat
                            this.graphicsLayerUserPoints.add(redPointGraphic);
                            const clickedP = new Point({
                                latitude: clickedPoint.latitude, // latitudine
                                longitude: clickedPoint.longitude // longitudine
                            });
                            // Afișează ruta
                            const routeParams = new RouteParameters({
                                stops: new FeatureSet({
                                    features: [
                                        
                                        new Graphic({ geometry: userPoint }), // Folosește locația utilizatorului
                                        new Graphic({ geometry: clickedP})
                                    ]
                                }),
                                returnDirections: true
                            });
    
                            route.solve(routeUrl, routeParams)
                                .then((data) => {
                                    this.displayRoute(data);
                                })
                                .catch((error) => {
                                    console.error("Eroare la calcularea rutei:", error);
                                    alert("Nu s-a putut calcula ruta.");
                                });
                        }
                    });
                },
                (error) => {
                    console.error("Eroare la obținerea locației curente:", error);
                    alert("Nu s-a putut obține locația curentă.");
                },
                {
                    enableHighAccuracy: true,
                    timeout: 5000,
                    maximumAge: 0
                }
            );
        } else {
            alert("Geolocalizarea nu este disponibilă.");
        }
    }
    
    displayRoute(data: any) {
        // Șterge toate rutele anterioare de pe hartă
        this.graphicsLayerRoutes.removeAll();
    
        // Parcurge toate rezultatele rutei
        data.routeResults.forEach((result: any) => {
            // Stilizează linia rutei
            result.route.symbol = {
                type: "simple-line", // Linie simplă
                color: [0, 0, 255], // Albastru
                width: 3 // Grosimea liniei
            };
    
            // Adaugă ruta pe stratul de grafică
            this.graphicsLayerRoutes.add(result.route);
        });
    
        // Afișează instrucțiunile de direcție, dacă sunt disponibile
        if (data.routeResults.length > 0 && data.routeResults[0].directions) {
            this.showDirections(data.routeResults[0].directions.features);
        } else {
            alert("Nu s-au găsit direcții pentru această rută.");
        }
    }
    
    showDirections(features: any[]) {
        const directionsElement = document.createElement("ol");
        directionsElement.classList.add("esri-widget", "esri-widget--panel", "esri-directions__scroller");
        directionsElement.style.marginTop = "0";
        directionsElement.style.padding = "15px 15px 15px 30px";
    
        features.forEach((result) => {
            const direction = document.createElement("li");
            direction.innerHTML = `${result.attributes.text} (${result.attributes.length.toFixed(2)} km)`;
            directionsElement.appendChild(direction);
        });
    
        this.view.ui.empty("top-right");
        this.view.ui.add(directionsElement, "top-right");
    }

    getCurrentLocation() {
    // Verifică dacă geolocalizarea este disponibilă
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;

                console.log("Locația curentă:", { lat, lng });

                // Actualizează locația utilizatorului în Firebase
                this.fbs.updateUserPosition({ latitude: lat, longitude: lng });

                // Crează un punct pentru locația utilizatorului
                const userPoint = new Point({
                    latitude: lat,
                    longitude: lng
                });

                // Simbolul pentru punctul utilizatorului
                const userSymbol = {
                    type: "simple-marker", // Tipul simbolului
                    color: [0, 120, 255], // Albastru
                    outline: { color: [255, 255, 255], width: 1 } // Contur alb
                };

                // Crearea graficului pentru a adăuga punctul pe hartă
                const userGraphic = new Graphic({
                    geometry: userPoint,
                    symbol: userSymbol
                });

                // Înlătură orice puncte anterioare și adaugă punctul nou
                this.graphicsLayerUserPoints.removeAll();
                this.graphicsLayerUserPoints.add(userGraphic);

                console.log("Coordonatele utilizatorului afișate pe hartă:", { lat, lng });
            },
            (error) => {
                console.error("Eroare la obținerea locației:", error);
                alert("Nu s-a putut obține locația utilizatorului.");
            },
            {
                enableHighAccuracy: true, // Precizie mare
                maximumAge: 0, // Nu folosi locația stocată
                timeout: 5000 // Timp de așteptare 5 secunde
            }
        );
    } else {
        console.error("Geolocalizarea nu este disponibilă în acest browser.");
        alert("Geolocalizarea nu este disponibilă.");
    }
}

    allLocations: any[] = []; // Array pentru a stoca toate locațiile
    filteredLocations: any[] = []; // Array pentru locațiile filtrate

    fetchLocations(): void {
        this.fbs.getMapPoints().subscribe((data: any[]) => {
            console.log('Date din Firebase:', data); // Verificăm datele primite
            this.allLocations = data; // Stocăm toate locațiile din Firebase
            this.filteredLocations = [...this.allLocations]; // Inițial, toate locațiile sunt afișate
        });
    }

    counties: string[] = [
        'Adjud', 'Aiud', 'Alba Iulia', 'Avrig', 'Baia Mare', 'Baia de Aramă', 'Bârlad', 'Beiuș', 'Bicaz', 
        'Bistrița', 'Blaj', 'București', 'Budești', 'Buftea', 'Bucium', 'Buzău', 'Bălcești', 
        'Călărași', 'Câmpina', 'Câmpulung Moldovenesc', 'Caracal', 'Caransebeș', 'Câmpulung', 'Cisnădie', 
        'Cluj-Napoca', 'Comănești', 'Constanța', 'Curtea de Argeș', 'Dej', 'Deva', 'Drobeta-Turnu Severin', 
        'Fălticeni', 'Făurei', 'Fetești', 'Focșani', 'Ghimbav', 'Galați', 'Giurgiu', 'Gheorgheni', 'Gura Humorului',
        'Iași', 'Ilfov', 'Imăraș', 'Ianca', 'Jibou', 'Lugoj', 'Ludus', 'Măgurele', 'Măcin', 'Medgidia', 'Mediaș', 
        'Miercurea Ciuc', 'Mihăilești', 'Moreni', 'Măieruș', 'Mihăiești', 'Mihăilești', 'Mangalia', 'Mărășești', 
        'Marghita', 'Negrești', 'Negrești-Oaș', 'Onești', 'Otopeni', 'Pașcani', 'Pitești', 'Ploiești', 'Pogoanele', 
        'Pucioasa', 'Râmnicu Sărat', 'Reghin', 'Roman', 'Rovinari', 'Roșiori de Vede', 'Reșița', 'Rădăuți', 
        'Sălaj', 'Săgeata', 'Sălciile', 'Sărdănești', 'Satu Mare', 'Săcele', 'Scornicești', 'Șimleu Silvaniei', 
        'Suceava', 'Sighișoara', 'Suceava', 'Sighetu Marmației', 'Ștefănești', 'Sibiu', 'Ștefan cel Mare', 
        'Suceava', 'Satu Mare', 'Salonta', 'Sighișoara', 'Slobozia', 'Sinaia', 'Târgu Jiu', 'Târgu Neamț', 
        'Târgu Mureș', 'Târgu Bujor', 'Târgu Frumos', 'Timișoara', 'Timiș', 'Târgoviște', 'Tulcea', 'Urziceni', 
        'Zalău', 'Zărnești', 'Zimnicea'
    ];
    
    

onSearchCounty(event: Event): void {
    const query = (event.target as HTMLInputElement).value.toLowerCase();
    this.filteredLocations = this.allLocations.filter(location =>
        location['Localitate'].toLowerCase().includes(query) // Filtrare după câmpul "Județ"
    );
}

onFilterCounty(event: Event): void {
    const selectedCounty = (event.target as HTMLSelectElement).value;
    if (selectedCounty) {
        this.filteredLocations = this.allLocations.filter(location =>
            location['Localitate'] === selectedCounty // Filtrare după județ selectat
        );
    } else {
        this.filteredLocations = [...this.allLocations]; // Resetare la toate locațiile
    }
}

    
    ngOnDestroy() {
        this.disconnectFirebase();
        if (this.view) {
            this.view.container = null;
        }
    }
}
                                       
