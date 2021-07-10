import { Doc, PhotoAlbum, Video } from "src/app/models/media"

export class SampleMediaService {

    get() {
        return [
            new PhotoAlbum(
                "",
                "SomeGuy",
                "",
                "https://i1.sndcdn.com/avatars-000432238356-t84yvc-t500x500.jpg",
                "1950s",
                "00:05:53",
                ["-LTtjt2CcYemzQ8koKwq", "-LTtju2MiLom4Jr_mSlC", "-LTtju2p_NxNUzWJwqB8", "-LTtju3NTbkrbTLWdeBD"],
            ),

            new Doc(
                "",
                "LeCours Family Farm - 1950s",
                "https://drive.google.com/file/d/1rCkREZhQZepugqwLvn7P6tYBQMejq0O2/view?usp=sharing",
                "https://drive.google.com/file/d/197RuL7K8bAg6aQI36OjEfCO27YRGG9Hz/view?usp=sharing",
                "Hardwick, VT",
                "1950s",
                "00:05:53",
                "1950s_HomeMovies_Farm_LeCoursFamily.mp4",
            ),

            new Video(
                "",
                "LeCours Family Farm - 1950s",
                "https://drive.google.com/file/d/1rCkREZhQZepugqwLvn7P6tYBQMejq0O2/view?usp=sharing",
                "https://drive.google.com/file/d/197RuL7K8bAg6aQI36OjEfCO27YRGG9Hz/view?usp=sharing",
                "Hardwick, VT",
                "1950s",
                "00:05:53",
                "1950s_HomeMovies_Farm_LeCoursFamily.mp4",
            ),

            new Video(
                "",
                "Diane & Emile's Wedding Ceremony - 1983-06-18",
                "https://drive.google.com/file/d/1DDzXlvBztaiZ9cReCB2RKgW_4moEFUT8/view?usp=sharing",
                "https://drive.google.com/file/d/1EkkgiXUbx2qdHv_4PmjfI-TB3boYGpkv/view?usp=sharing",
                "Hardwick, VT",
                "1983-06-18",
                "00:31:24",
                "1983-06-18_Ceremony_Wedding_Hardwick_DianeLeCours+EmileFournier.mp4",
            ),

            new Video(
                "",
                "Diane & Emile's Wedding Reception - 1983-06-18",
                "https://drive.google.com/file/d/1DDzXlvBztaiZ9cReCB2RKgW_4moEFUT8/view?usp=sharing",
                "https://drive.google.com/file/d/1zsnYlsvYu7OfWjLpNwNEL4aqJyQL62nq/view?usp=sharing",
                "Hardwick, VT",
                "1983-06-18",
                "00:24:55",
                "1983-06-18_Reception_Wedding_Hardwick_DianeLeCours+EmileFournier.mp4",
            ),


            new Video(
                "",
                "Deer Camp Strategy Session - Hardwick - 1985",
                "https://drive.google.com/file/d/1ZmF_y750YRgPKp22ySaPhLVnIY3cw34Z/view?usp=sharing",
                "https://drive.google.com/file/d/1xU2Rc2wwXx1HhG1YA7D5y0DRP14o1qd3/view?usp=sharing",
                "West Church Street, Hardwick, VT",
                "1985",
                "02:01:20",
                "1985_Party_DeerCamp_Hardwick_StrategySession.mp4",
            ),

            new Video(
                "",
                "Fourth of July - Caspian Lake - 1986",
                "https://drive.google.com/file/d/1uRNDDbfp_9dV17GMpVtH4mx2W_dd7NgP/view?usp=sharing",
                "https://drive.google.com/file/d/1n_tzHP0Zg9bzzBmqoPFZAGLGUt6iwHks/view?usp=sharing",
                "Caspian Lake, Greensboro, VT",
                "1986-07-04",
                "00:54:05",
                "1986-07-04_Party_Camp_Hardwick_CaspianLake_FourthOfJuly.mp4",
            ),

            new Video(
                "",
                "Lori's Confirmation Party - Shelburne - 1986-09-07",
                "https://drive.google.com/file/d/1W6skPVrpM4RtbEJgCa8U-CbnroIy0rda/view?usp=sharing",
                "https://drive.google.com/file/d/1PaPycGvbM_enDSSwBkda6NRI6-260xsY/view?usp=sharing",
                "Shelburne, VT",
                "1986-09-07",
                "00:01:19",
                "1986-09-07_Party_Confirmation_Shelburne_LoriIngraham.mp4",
            ),

            new Video(
                "",
                "Mary's High School Graduation Party - 1987-06-20",
                "https://drive.google.com/file/d/16x5vP51_-ATcw66m3y8ZENG-yHk5eEOL/view?usp=sharing",
                "https://drive.google.com/file/d/19Uy7bBklQLLN7M1VXouDVk70tPcB1Y2J/view?usp=sharing",
                "Underhill, VT",
                "1987-06-20",
                "00:12:02",
                "1987-06-20_Party_Graduation_HighSchool_Underhill_MaryLeCours.mp4",
            ),

            new Video(
                "",
                "French Heritage - 1987 - The LeBlanc Family - Larry & Nita Footage",
                "https://drive.google.com/file/d/1SRVK_CnpE2AFtQ0cfsxcal7Ue2lSA_2c/view?usp=sharing",
                "https://drive.google.com/file/d/12iwar8zKvv1j3cB5Kpxn3qyqHHPOigFX/view?usp=sharing",
                "Hardwick, VT",
                "1987-08-08",
                "00:19:16",
                "1987-08-08_Festival_Hardwick_FrenchHeritage_LeBlancFamily_Nita+LawrenceLeCoursFootage.mp4",
            ),

            new Video(
                "",
                "French Heritage - 1987 - The LeBlanc Family - Vanessa Fournier Footage",
                "https://drive.google.com/file/d/1NULtmhVJEY_WRIpA9gMhDp2ar3Ww9ovc/view?usp=sharing",
                "https://drive.google.com/file/d/11Pl61K807vMNokoTAYlxd8bNvvHanSYj/view?usp=sharing",
                "Hardwick, VT",
                "1987-08-08",
                "00:19:45",
                "1987-08-08_Festival_Hardwick_FrenchHeritage_LeBlancFamily_VanessaFournierFootage.mp4",
            ),

            new Video(
                "",
                "News Coverage of Lawrence as Santa at the University Mall - 1987-11-22",
                "https://drive.google.com/file/d/14pvSvz_K5GEeQ-NKfbeFrOLy7i57KsbX/view?usp=sharing",
                "https://drive.google.com/file/d/1CuThT_qm0OhUfUsR_YPqOGA4dl5VRgj4/view?usp=sharing",
                "South Burlington, VT",
                "1987-11-22",
                "00:01:15",
                "1987-11-22_News_Santa_UniversityMall_LawrenceLeCours.mp4",
            ),
        ];
    }
}
