import { Component } from '@angular/core';
import { Platform, AlertController } from 'ionic-angular';
import { ViewChild } from '@angular/core';
import { StatusBar } from '@ionic-native/status-bar';
import { SplashScreen } from '@ionic-native/splash-screen';
// angularfire2
import { AngularFireAuth } from "angularfire2/auth/auth";
// import service
import { AuthService } from "../services/auth-service";
import { PlaceService } from "../services/place-service";
import { DriverService } from "../services/driver-service";
import { TranslateService } from '@ngx-translate/core';
import { DealService } from "../services/deal-service";
import { UserPage } from "../pages/user/user";
import { WalletPage } from '../pages/wallet/wallet';
import { JobHistoryPage } from '../pages/job-history/job-history';

import { Geolocation } from '@ionic-native/geolocation';
// import page
import { HomePage } from '../pages/home/home';
import { LoginPage } from '../pages/login/login';
import { TripService } from "../services/trip-service";
import { PickUpPage } from "../pages/pick-up/pick-up";

import { TRIP_STATUS_WAITING, TRIP_STATUS_GOING, DEAL_STATUS_PENDING, DEAL_TIMEOUT, POSITION_INTERVAL, PLAY_AUDIO_ON_REQUEST, AUDIO_PATH } from "../services/constants";

declare var google: any;
@Component({
  templateUrl: 'app.html',
  queries: {
    nav: new ViewChild('content')
  }
})
export class MyApp {
  rootPage: any;
  nav: any;
  positionTracking: any;
  driver: any;
  user: any = {};
  map: any;
  deal: any;
  dealSubscription: any;
  isDriverAvailable: any = false;
  dealStatus: any = false;
  public job: any;
  public remainingTime = DEAL_TIMEOUT;

  constructor(platform: Platform, statusBar: StatusBar, splashScreen: SplashScreen, public alertCtrl: AlertController, public placeService: PlaceService,
  public driverService: DriverService, afAuth: AngularFireAuth,
    public authService: AuthService, public dealService: DealService, tripService: TripService, public geolocation: Geolocation,
    public translate: TranslateService) {
    this.translate.setDefaultLang('en');
    this.translate.use('en');
    platform.ready().then(() => {
      // Okay, so the platform is ready and our plugins are available.
      // Here you can do any higher level native things you might need.
      statusBar.styleDefault();
      splashScreen.hide();

      // check for login stage, then redirect
      afAuth.authState.take(1).subscribe(authData => {
        if (authData) {
          let root: any = HomePage;

          // check for uncompleted trip
          tripService.getTrips().take(1).subscribe(trips => {
            trips.forEach(trip => {
              if (trip.status == TRIP_STATUS_WAITING || trip.status == TRIP_STATUS_GOING) {
                tripService.setCurrentTrip(trip.$key);
                root = PickUpPage;
              }
            });

            // if all trip are completed, go to home page
            this.nav.setRoot(root);
          });
        } else {
          this.nav.setRoot(LoginPage);
        }
      });

      // get user data
      afAuth.authState.subscribe(authData => {
        console.log(authData);
        if (authData) {
          this.user = authService.getUserData();

          // get user info from service
          driverService.setUser(this.user);
          driverService.getDriver().subscribe(snapshot => {
            this.driver = snapshot;
            this.driver.rating = Array(this.driver.rating).fill(0).map((x,i)=>i);
          });
        } else {
          this.driver = null;
        }
      });
    });
  }

  logout() {
    this.authService.logout().then(() => {
      this.nav.setRoot(LoginPage);
    });
  }

  loadMap(lat,lng){
    let latLng = new google.maps.LatLng(lat,lng);
    this.map = new google.maps.Map(document.getElementById('map'), {
      zoom: 15,
      center: latLng,
      mapTypeId: google.maps.MapTypeId.ROADMAP,
      mapTypeControl: false,
      zoomControl: false,
      streetViewControl: false,
    });
    new google.maps.Marker({
      map: this.map,
      animation: google.maps.Animation.DROP,
      position: latLng
    });
  }

  changeAvailability(){
    console.log(this.isDriverAvailable);
    if(this.isDriverAvailable == true){
            // get current location
            this.geolocation.getCurrentPosition().then((resp) => {
              let latLng = new google.maps.LatLng(resp.coords.latitude, resp.coords.longitude);
              let geocoder = new google.maps.Geocoder();
    
              this.loadMap(resp.coords.latitude,resp.coords.longitude);
              // find address from lat lng
              geocoder.geocode({'latLng': latLng}, (results, status) => {
                if (status == google.maps.GeocoderStatus.OK) {
                  // save locality
                  let locality = this.placeService.setLocalityFromGeocoder(results);
                  console.log('locality', locality);
                  
                  // start tracking
                  this.positionTracking = setInterval(() => {
                    // check for driver object, if it did not complete profile, stop updating location
                    console.log("pos track")
                    if (!this.driver || !this.driver.type) {
                      return;
                    }
                    // Immediate update
                    this.driverService.updatePosition(this.driver.$key, this.driver.type, locality, resp.coords.latitude,resp.coords.longitude, this.driver.rating, this.driver.name);

                    // Periodic update after particular time intrvel
                    this.geolocation.getCurrentPosition().then((resp) => {
                      console.log(resp);
                      this.driverService.updatePosition(this.driver.$key, this.driver.type, locality, resp.coords.latitude,resp.coords.longitude, this.driver.rating, this.driver.name);
                    }, err => {
                      console.log(err);
                    });

                  }, POSITION_INTERVAL);
                  

                  this.watchDeals();
                }
              });
            }, err => {
              console.log(err);
            });
      
    }
    else{
      clearInterval(this.positionTracking);
      if (this.dealSubscription) {
        // unsubscribe when leave this page
        this.dealSubscription.unsubscribe();
      } 
    }
    
  }

  // count down
  countDown() {
    let interval = setInterval(() => {
      this.remainingTime--;
      if (this.remainingTime == 0) {
        clearInterval(interval)
        this.cancelDeal();
        this.remainingTime = DEAL_TIMEOUT;
      }
    }, 1000);
    this.confirmJob();
  }

  cancelDeal(){
    console.log("close")
    this.dealStatus = false;
    this.dealService.removeDeal(this.driver.$key);
  }

  // confirm a job
  confirmJob() {
    console.log("confirm");
    let message = "<b>From:</b> ("+this.job.origin.distance+"km)<br/>"+ this.job.origin.vicinity +"<br/><br/> <b>To:</b>("+this.job.destination.distance+"km)<br>"+this.job.destination.vicinity+"";

    let confirm = this.alertCtrl.create({
      title: 'New Request',
      message:message,
      buttons: [
        {
          text: 'Reject',
          handler: () => {
            console.log('Disagree clicked');
            this.dealStatus = false;
            this.dealService.removeDeal(this.driver.$key);
          }
        },
        {
          text: 'Accept',
          handler: () => {
            this.dealStatus = false;
            this.dealService.acceptDeal(this.driver.$key, this.deal).then(() => {
              // go to pickup page
              this.nav.setRoot(PickUpPage);
            });
          }
        }
      ]
    });
    confirm.present();
    this.playAudio();
  }

  // listen to deals
  watchDeals() {
    // listen to deals
    this.dealSubscription = this.dealService.getDeal(this.driver.$key).subscribe(snapshot => {
      this.deal = snapshot;
      if (snapshot.status == DEAL_STATUS_PENDING) {
        // if deal expired
        if (snapshot.createdAt < (Date.now() - DEAL_TIMEOUT * 1000)) {
          return this.dealService.removeDeal(this.driver.$key);
        }
        this.dealStatus = true;
        console.log(this.dealStatus);
        
        
        this.job = snapshot;

        this.geolocation.getCurrentPosition().then((resp) => {
          //resp.coords.longitude
          this.job.origin.distance = this.placeService.calcCrow( resp.coords.latitude, resp.coords.longitude, this.job.origin.location.lat,this.job.origin.location.lng).toFixed(0);
          this.job.destination.distance = this.placeService.calcCrow( resp.coords.latitude, resp.coords.longitude, this.job.destination.location.lat,this.job.destination.location.lng).toFixed(0);
          this.countDown();
        }, err => {
          console.log(err);
        });
      }
    });
  }

  goProfile(){
    this.nav.push(UserPage,{ user: this.authService.getUserData()});
  }

  goWallet(){
    this.nav.push(WalletPage);
  }
  goHistory(){
    this.nav.push(JobHistoryPage);
  }
  playAudio(){
    if(PLAY_AUDIO_ON_REQUEST == true){
      let audio = new Audio(AUDIO_PATH);
      audio.play();
    }
  }
}

