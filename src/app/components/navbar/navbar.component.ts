import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthenticationService } from './services/authentication.service';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss']
})
export class NavbarComponent implements OnInit {

  email: string | null = null; // Variabilă pentru a stoca email-ul utilizatorului conectat

  constructor(
    private authenticationService: AuthenticationService,
    private router: Router
  ) { }

  ngOnInit(): void {
    // Obținem email-ul utilizatorului conectat
    this.authenticationService.getCurrentUserEmail().subscribe((email) => {
      this.email = email;
    });
  }

  logout() {
    this.router.navigate(['signin']);

    this.authenticationService.logout().subscribe(() => {
      console.log('User logged out');
      this.email = null; // Resetăm email-ul după deconectare
    });
  }

}
