import { Component } from '@angular/core';
import { NavController, AlertController, LoadingController, ToastController, MenuController } from 'ionic-angular';
import { RegisterPage } from '../register/register';
import { HomePage } from '../home/home'
import { AuthService } from "../../services/auth-service";
import { ENABLE_SIGNUP } from "../../services/constants";
import * as firebase from 'firebase';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'page-login',
  templateUrl: 'login.html'
})
export class LoginPage {
  userInfo: any = {};
  isRegisterEnabled = ENABLE_SIGNUP;

  constructor(public nav: NavController, public menu:MenuController, public authService: AuthService, public alertCtrl: AlertController, public loadingCtrl: LoadingController, public toast: ToastController, public translate: TranslateService) { 
    this.menu.enable(false);
  }

  // go to signup page
  signup() {
    this.nav.push(RegisterPage);
  }

  // go to login page
  login() {
    let loading = this.loadingCtrl.create({ content: 'Please wait...' });
    loading.present();
    if(this.userInfo.email != null && this.userInfo.password != null){
      this.authService.login(this.userInfo.email, this.userInfo.password).then(authData => {
        loading.dismiss();
        this.nav.setRoot(HomePage);
      }, error => {
        loading.dismiss();
        let alert = this.alertCtrl.create({
          message: error.message,
          //duration: 3000
          buttons: ['OK']
        });
        alert.present();
      });
    }
    else{
      loading.dismiss();
        let alert = this.toast.create({
          message: 'Please enter valid email id',
          duration: 3000
          //buttons: ['OK']
        });
        alert.present();
    }
  }

  reset() {
    if (this.userInfo.email) {
      firebase.auth().sendPasswordResetEmail(this.userInfo.email)
        .then(data =>
          this.toast.create({ message: 'Please check your mail', duration: 3000 }).present())
        .catch(err => this.toast.create({ message: err.message, duration: 3000 }).present())
    } else{
      this.toast.create({ message: 'Please enter email address first', duration: 3000 }).present()
    }
  }
}