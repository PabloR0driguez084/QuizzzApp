import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { doc, docData, updateDoc } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule],
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss']
})
export class ProfilePage implements OnInit {
  userProfile: any = {
    name: '',
    age: null,
    photoUrl: '',
    description: ''
  };
  uid: string | null = null;

  constructor(private auth: Auth, private firestore: Firestore) {}

  async ngOnInit() {
    const user = this.auth.currentUser;
    if (user) {
      this.uid = user.uid;
      const profileRef = doc(this.firestore, 'users', this.uid);
      docData(profileRef).subscribe(data => {
        this.userProfile = data;
      });
    }
  }

  async updateProfile() {
    if (this.uid) {
      const profileRef = doc(this.firestore, 'users', this.uid);
      await updateDoc(profileRef, {
        name: this.userProfile.name,
        age: this.userProfile.age,
        photoUrl: this.userProfile.photoUrl,
        description: this.userProfile.description,
      });
    }
  }
}
