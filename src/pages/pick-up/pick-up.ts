import { Component } from '@angular/core';
import { NavController, AlertController } from 'ionic-angular';
import { TripService } from "../../services/trip-service";
import { DealService } from "../../services/deal-service";
import { HomePage } from '../home/home';
import * as firebase from 'firebase';

@Component({
  selector: 'page-pick-up',
  templateUrl: 'pick-up.html'
})
export class PickUpPage {
  // trip info
  trip: any;
  passenger: any = {};
  isTripStarted = false;

  constructor(public nav: NavController, public tripService: TripService, public alertCtrl: AlertController,
    public dealService: DealService) {
    this.trip = tripService.getCurrentTrip();
    let getTrips = tripService.getTripStatus(this.trip.$key).subscribe( trip => {
      if(trip.status == 'canceled'){
        getTrips.unsubscribe();
        this.tripService.cancel(this.trip.$key);
        this.dealService.removeDeal(this.trip.driverId);
        this.alertCtrl.create({ title:'Trip Canceled'}).present();
        this.nav.setRoot(HomePage);
      }
    })
    tripService.getPassenger(this.trip.passengerId).take(1).subscribe(snapshot => {
      this.passenger = snapshot;
    })
  }

  // pickup
  pickup() {
    this.alertCtrl.create({
      subTitle: "Please Enter OTP from customer",
      inputs:[{
        name: 'otp',
        placeholder: '4 digit OTP'
      }],
      buttons:[{
        text: "Verify",
        handler: (data) =>{
          console.log(data);
          console.log(this.trip.$key);
          firebase.database().ref('trips/'+this.trip.$key).once('value', snap => {
            console.log(snap.val())
            if(snap.val().otp != data.otp){
              this.alertCtrl.create({ title: 'Error', subTitle: 'Invalide OTP'}).present();
            }
            else{
              this.isTripStarted = true;
              this.tripService.pickUp(this.trip.$key);
            }
          })
        }
      }]
    }).present();
  }

  getDirection(lat,lng){
    console.log("call");
    let url = "https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=Current Location&destination="+lat+","+lng;
    window.open(url);
  }

  showPayment() {
    let final = this.trip.fee - (this.trip.fee * (parseInt(this.trip.discount) / 100))
    this.alertCtrl.create({
      message: '<h1>'+this.trip.currency+' '+final+'</h1> <p>Fee: '+ this.trip.fee + ' <br> Discount (%): '+this.trip.discount+' ('+this.trip.promocode+')<br>Payment Method: '+this.trip.paymentMethod+'</p>',
      buttons: [
        {
          text: 'OK',
          handler: () => {
            this.tripService.dropOff(this.trip.$key);
            this.dealService.removeDeal(this.trip.driverId);
            this.nav.setRoot(HomePage);
          }
        }
      ]
    }).present();
  }
}
