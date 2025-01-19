import { Injectable } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { Observable } from 'rxjs';

export interface IDatabaseItem {
    Nume: string;
    Adresa: string;
    Email: string;
    Județ: string;
    Localitate: string;
    Program: string;
    Site: string;
    Telefon: string;
    latitude: number;
    longitude: number;
}

@Injectable()
export class FirebaseService {

    listFeed: Observable<any[]>;
    objFeed: Observable<any>;

    constructor(public db: AngularFireDatabase) {}

    // Conectare la baza de date
    connectToDatabase() {
        this.listFeed = this.db.list('list').valueChanges();
        this.objFeed = this.db.object('obj').valueChanges();
    }

    // Obține feed-ul de schimbări pentru lista de locații
    getChangeFeedList() {
        return this.listFeed;
    }

    // Obține feed-ul de schimbări pentru obiectul specificat
    getChangeFeedObject() {
        return this.objFeed;
    }

    // Șterge elementele din lista de locații
    removeListItems() {
        this.db.list('list').remove();
    }

    // Adaugă un obiect simplu în lista de locații
    addSimpleListObject(val: string) {
        let item: IDatabaseItem = {
            Nume: "test",
            Adresa: "Strada Exemplu Nr. 1",
            Email: "",
            Județ: "Random",
            Localitate: "Exemplu",
            Program: "Luni-Vineri 10:00-18:00",
            Site: "",
            Telefon: "0247 123 456",
            latitude: 44.39846573578901,
            longitude: 26.11530834523235
        };
        this.db.list('list').push(item);
    }

    // Actualizează un obiect în baza de date
    updateObject(val: string) {
        let item: IDatabaseItem = {
            Nume: "test",
            Adresa: "Strada Exemplu Nr. 1",
            Email: "",
            Județ: "Random",
            Localitate: "Exemplu",
            Program: "Luni-Vineri 10:00-18:00",
            Site: "",
            Telefon: "0247 123 456",
            latitude: 44.39846573578901,
            longitude: 26.11530834523235
        };
        this.db.object('obj').set([item]);
    }

    // Actualizează poziția utilizatorului în Firebase
    updateUserPosition(position: { latitude: number; longitude: number }) {
        this.db.object('userPosition').set(position);
    }

    // Obține poziția utilizatorului
    getUserPosition() {
        return this.db.object('userPosition').valueChanges();
    }

    // Adaugă un obiect de locație (punct pe hartă) în lista din Firebase
    addListObject(data: { Strada:string; Numar:string;
        Email: string;
        Localitate: string; Nume: string; Program: string;
        Site: string; Telefon: string;
        latitude: number; longitude: number}) {
        // Adăugăm un punct de locație în lista de puncte din Firebase
        this.db.list('mapPoints').push(data);
    }

    // Obține toate punctele de pe hartă din Firebase
    getMapPoints() {
        return this.db.list('mapPoints').valueChanges();
    }
}
