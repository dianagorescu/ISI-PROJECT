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

                // Obținerea cabinetelor veterinare din Google Places API
                //this.fetchVeterinaryLocationsFromAPI();
            });
        } catch (error) {
            console.error("Error loading the map: ", error);
            alert("Error loading the map");
        }
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

    fetchVeterinaryLocationsFromAPI() {
        const url = 'https://nominatim.openstreetmap.org/search?q=cabinet+veterinar&format=json';
    
        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                data.forEach(place => {
                    // Preia coordonatele necesare
                    const latitude = parseFloat(place.lat);
                    const longitude = parseFloat(place.lon);
    
                    // Adaugă coordonatele în Firebase
                    this.addPointToFirebase(latitude, longitude);
                });
                console.log("Locațiile cabinetelor veterinare au fost adăugate din Nominatim API.");
            })
            .catch(error => console.error("Eroare la preluarea locațiilor:", error));
    }
    // *********************************************

    addPointToFirebase(lat: number, lng: number) {
        // Salvăm coordonatele punctului în Firebase
        this.fbs.addListObject({ latitude: lat, longitude: lng });
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
            this.view.on("click", (event) => {
                const point = this.view.toMap({ x: event.x, y: event.y });
                if (point) {
                    // Adaugă punctul în Firebase și pe hartă
                    this.addPointToFirebase(point.latitude, point.longitude);
                }
            });

            await this.view.when();
            console.log("ArcGIS map loaded");
            this.addRouting();
            this.addSearchWidget();
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
            url: "https://services1.arcgis.com/equSgvG6lh32w77K/arcgis/rest/services/Romania1000k/FeatureServer/3",
            outFields: ['*'], // Selectez toate câmpurile disponibile
            popupTemplate: {
                title: "Detalii Drum",
                content: `
                    <b>Tip Drum:</b> {TIP1}<br>
                    <b>Nume Drum Principal:</b> {NUME1}<br>
                    <b>Tip Drum Secundar:</b> {TIP2}<br>
                    <b>Nume Drum Secundar:</b> {NUME2}<br>
                    <b>Enabled:</b> {Enabled}
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

    addRouting() {
        const routeUrl = "https://route-api.arcgis.com/arcgis/rest/services/World/Route/NAServer/Route_World";
        this.view.on("click", (event) => {
            this.view.hitTest(event).then((elem: esri.HitTestResult) => {
                if (elem && elem.results && elem.results.length > 0) {
                    let point: esri.Point = elem.results.find(e => e.layer === this.trailheadsLayer)?.mapPoint;
                    if (point) {
                        console.log("get selected point: ", elem, point);
                        if (this.graphicsLayerUserPoints.graphics.length === 0) {
                            this.addPoint(point.latitude, point.longitude);
                        } else if (this.graphicsLayerUserPoints.graphics.length === 1) {
                            this.addPoint(point.latitude, point.longitude);
                            this.calculateRoute(routeUrl);
                        } else {
                            this.removePoints();
                        }
                    }
                }
            });
        });
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

    async calculateRoute(routeUrl: string) {
        const routeParams = new RouteParameters({
            stops: new FeatureSet({
                features: this.graphicsLayerUserPoints.graphics.toArray()
            }),
            returnDirections: true
        });

        try {
            const data = await route.solve(routeUrl, routeParams);
            this.displayRoute(data);
        } catch (error) {
            console.error("Error calculating route: ", error);
            alert("Error calculating route");
        }
    }

    displayRoute(data: any) {
        for (const result of data.routeResults) {
            result.route.symbol = {
                type: "simple-line",
                color: [5, 150, 255],
                width: 3
            };
            this.graphicsLayerRoutes.graphics.add(result.route);
        }
        if (data.routeResults.length > 0) {
            this.showDirections(data.routeResults[0].directions.features);
        } else {
            alert("No directions found");
        }
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

    showDirections(features: any[]) {
        this.directionsElement = document.createElement("ol");
        this.directionsElement.classList.add("esri-widget", "esri-widget--panel", "esri-directions__scroller");
        this.directionsElement.style.marginTop = "0";
        this.directionsElement.style.padding = "15px 15px 15px 30px";

        features.forEach((result, i) => {
            const direction = document.createElement("li");
            direction.innerHTML = `${result.attributes.text} (${result.attributes.length} miles)`;
            this.directionsElement.appendChild(direction);
        });

        this.view.ui.empty("top-right");
        this.view.ui.add(this.directionsElement, "top-right");
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


    ngOnDestroy() {
        this.disconnectFirebase();
        if (this.view) {
            this.view.container = null;
        }
    }
}
