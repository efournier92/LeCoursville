import { firebase, firebaseui } from 'firebaseui-angular';

export const AuthConfig: firebaseui.auth.Config = {
  signInFlow: 'popup',
  signInOptions: [
    firebase.auth.EmailAuthProvider.PROVIDER_ID,
    // firebase.auth.GoogleAuthProvider.PROVIDER_ID,
    // {
    //   requireDisplayName: true,
    //   provider: firebase.auth.EmailAuthProvider.PROVIDER_ID,
    // },
  ],
  credentialHelper: firebaseui.auth.CredentialHelper.ACCOUNT_CHOOSER_COM,
};

