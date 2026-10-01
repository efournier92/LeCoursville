import { LocationStrategy, PathLocationStrategy } from "@angular/common";
import { NO_ERRORS_SCHEMA, NgModule } from "@angular/core";
import { adapterFactory } from "angular-calendar/date-adapters/date-fns";

// Imports
import { AppRoutingModule } from "src/app/app-routing.module";
import { BrowserModule } from "@angular/platform-browser";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { CalendarModule, DateAdapter } from "angular-calendar";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { provideHttpClient, withInterceptorsFromDi, withXhr } from "@angular/common/http";
import { MaterialModule } from "src/app/modules/material.module";
import { NgxExtendedPdfViewerModule } from "ngx-extended-pdf-viewer";
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from "@angular/material/form-field";

// Declarations
import { AdminComponent } from "src/app/components/admin/admin.component";
import { AdminUsersComponent } from "src/app/components/admin-users/admin-users.component";
import { AdminMediaComponent } from "src/app/components/admin-media/admin-media.component";
import { AppComponent } from "src/app/app.component";
import { AuthComponent } from "src/app/components/auth/auth.component";
import { CalendarCellComponent } from "src/app/components/calendar-cell/calendar-cell.component";
import { CalendarComponent } from "src/app/components/calendar/calendar.component";
import { CalendarDatepickerDialogComponent } from "src/app/components/calendar-datepicker-dialog/calendar-datepicker-dialog.component";
import { CalendarPrinterComponent } from "src/app/components/calendar-printer/calendar-printer.component";
import { CalendarViewComponent } from "src/app/components/calendar-view/calendar-view.component";
import { ChatComponent } from "src/app/components/chat/chat.component";
import { ChatEditComponent } from "src/app/components/chat-edit/chat-edit.component";
import { ChatViewComponent } from "src/app/components/chat-view/chat-view.component";
import { PromptModalComponent } from "src/app/components/prompt-modal/prompt-modal.component";
import { ContactCardComponent } from "src/app/components/contacts/contact-card/contact-card.component";
import { ContactEditComponent } from "src/app/components/contacts/contact-edit/contact-edit.component";
import { ContactViewComponent } from "src/app/components/contacts/contact-view/contact-view.component";
import { ContactsComponent } from "src/app/components/contacts/contacts.component";
import { ContactInfoComponent } from "src/app/components/contact-info/contact-info.component";
import { FileInputComponent } from "src/app/components/file-input/file-input.component";
import { MediaExplorerComponent } from "src/app/components/media-explorer/media-explorer.component";
import { MediaListComponent } from "src/app/components/media-list/media-list.component";
import { PhotoAlbumComponent } from "./components/photo-album/photo-album.component";
import { PhotoUploadProgressComponent } from "src/app/components/photo-upload-progress/photo-upload-progress.component";
import { PhotoShellComponent } from "src/app/components/photo-shell/photo-shell.component";
import { PhotoAlbumsComponent } from "src/app/components/photo-albums/photo-albums.component";
import { PhotoAlbumDetailComponent } from "src/app/components/photo-album-detail/photo-album-detail.component";
import { PhotoSlideshowComponent } from "src/app/components/photo-slideshow/photo-slideshow.component";
import { PhotosLegacyComponent } from "src/app/components/photos-legacy/photos-legacy.component";
import { AudioPlayerComponent } from "src/app/components/audio-player/audio-player.component";
import { MediaTypesCheckboxesComponent } from "src/app/components/media-types-checkboxes/media-types-checkboxes.component";
import { MediaSearchInputComponent } from "src/app/components/media-search-input/media-search-input.component";
import { VideoPlayerDriveIframeComponent } from "src/app/components/video-player-drive-iframe/video-player-drive-iframe.component";
import { VideoPlayerVideogularComponent } from "src/app/components/video-player-videogular/video-player-videogular.component";
import { DocViewerNgxExtendedComponent } from "src/app/components/doc-viewer-ngx-extended/doc-viewer-ngx-extended.component";
import { AdminMediaUploadAudioAlbumComponent } from "src/app/components/admin-media-upload-audio-album/admin-media-upload-audio-album.component";
import { AdminRoutingComponent } from "./components/admin-routing/admin-routing.component";
import { UserViewComponent } from "./components/user-view/user-view.component";
import { UserEditComponent } from "./components/user-edit/user-edit.component";
import { MediaAudioComponent } from "src/app/components/media-audio/media-audio.component";
import { MediaVideoComponent } from "./components/media-video/media-video.component";
import { AdminMediaUploadVideoComponent } from "./components/admin-media-upload-video/admin-media-upload-video.component";
import { NavbarLinksComponent } from "./components/navbar-links/navbar-links.component";
import { AdminFeaturesComponent } from "./components/admin-features/admin-features.component";
import { FeatureDisabledComponent } from "./components/feature-disabled/feature-disabled.component";
import { ExpressionsComponent } from "./components/expressions/expressions.component";
import { ExpressionViewComponent } from "src/app/components/expression-view/expression-view.component";
import { ExpressionEditComponent } from "./components/expression-edit/expression-edit.component";
import { PeopleComponent } from "./components/people/people.component";
import { LvLoadErrorComponent } from "src/app/components/load-error/load-error.component";
import { PersonDetailModalComponent } from "./components/person-detail-modal/person-detail-modal.component";
import { NoResultsMessageComponent } from "./components/no-results-message/no-results-message.component";
import { PageToolbarComponent } from "./components/shared/page-toolbar/page-toolbar.component";
import { PersonTreeComponent } from "./components/shared/person-tree/person-tree.component";
import { AdminPeopleImportComponent } from "./components/admin-people-import/admin-people-import.component";
import { AdminFamiliesComponent } from "./components/admin-families/admin-families.component";
import { AdminCalendarsComponent } from "./components/admin-calendars/admin-calendars.component";

@NgModule({ declarations: [
        AdminComponent,
        AdminMediaComponent,
        AdminUsersComponent,
        AppComponent,
        AuthComponent,
        CalendarCellComponent,
        CalendarComponent,
        CalendarDatepickerDialogComponent,
        CalendarPrinterComponent,
        CalendarViewComponent,
        ChatComponent,
        ChatEditComponent,
        ChatViewComponent,
        PromptModalComponent,
        ContactCardComponent,
        ContactEditComponent,
        ContactViewComponent,
        ContactsComponent,
        ContactInfoComponent,
        FileInputComponent,
        MediaExplorerComponent,
        MediaListComponent,
        PhotoAlbumComponent,
        PhotoShellComponent,
        PhotoAlbumsComponent,
        PhotoAlbumDetailComponent,
        PhotoSlideshowComponent,
        PhotosLegacyComponent,
        AudioPlayerComponent,
        MediaTypesCheckboxesComponent,
        MediaSearchInputComponent,
        VideoPlayerDriveIframeComponent,
        VideoPlayerVideogularComponent,
        DocViewerNgxExtendedComponent,
        AdminMediaUploadAudioAlbumComponent,
        AdminRoutingComponent,
        AdminFeaturesComponent,
        FeatureDisabledComponent,
        UserViewComponent,
        UserEditComponent,
        MediaAudioComponent,
        MediaVideoComponent,
        AdminMediaUploadVideoComponent,
        NavbarLinksComponent,
        ExpressionsComponent,
        ExpressionViewComponent,
        ExpressionEditComponent,
        PeopleComponent,
        PersonDetailModalComponent,
        PersonTreeComponent,
        AdminPeopleImportComponent,
        AdminFamiliesComponent,
        AdminCalendarsComponent,
    ],
    schemas: [NO_ERRORS_SCHEMA],
    bootstrap: [AppComponent],
    exports: [ContactEditComponent], imports: [AppRoutingModule,
        BrowserModule,
        BrowserAnimationsModule,
        CalendarModule.forRoot({
            provide: DateAdapter,
            useFactory: adapterFactory,
        }),
        FormsModule,
        MaterialModule,
        // Standalone components used in templates of module-declared components.
        LvLoadErrorComponent,
        NoResultsMessageComponent,
        PageToolbarComponent,
        PhotoUploadProgressComponent,
        NgxExtendedPdfViewerModule,
        ReactiveFormsModule], providers: [{ provide: LocationStrategy, useClass: PathLocationStrategy }, provideHttpClient(withXhr(), withInterceptorsFromDi()), { provide: MAT_FORM_FIELD_DEFAULT_OPTIONS, useValue: { appearance: "outline" } }] })
export class AppModule {}
