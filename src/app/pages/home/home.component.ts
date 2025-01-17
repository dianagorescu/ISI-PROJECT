import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthenticationService } from 'src/app/components/navbar/services/authentication.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {

  constructor(private router: Router) {}

  // tabs = [
  //   { name: 'Home', link: '/home' },
  //   { name: 'Map', link: '/home/map' }
  // ];
  // activeTab = '/home';

  goToMap(): void {
    this.router.navigate(['/map']);
  }
  

  ngOnInit(): void {
  }

}
