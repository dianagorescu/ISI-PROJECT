import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { from, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthenticationService {

  constructor(
    private auth: AngularFireAuth
  ) { }

  getCurrentUserEmail(): Observable<string | null> {
    return new Observable<string | null>((observer) => {
      this.auth.authState.subscribe(user => {
        if (user) {
          observer.next(user.email); // Returnăm email-ul utilizatorului
        } else {
          observer.next(null); // Nu există utilizator conectat
        }
        observer.complete();
      });
    });
  }

  logout(): Observable<void> {
    return from(this.auth.signOut());
  }

}