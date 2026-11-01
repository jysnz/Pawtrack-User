/**
 * PawTrack phrase translator
 * Most screens are translated through the keyed dictionaries in i18n.js. This file covers the text that is
 * written straight into the HTML and the views: while the language is Tagalog (fil), every text node,
 * placeholder, title and aria-label whose whole text matches an entry below is swapped, including text the
 * views add later. Switching back to English restores the original text.
 */
(function () {
  const FIL = {
    // Sidebar, header and account menu
    'NFC RECOVERY': 'PAGHAHANAP NG ALAGA',
    'Pets': 'Mga Alaga',
    'Missing Pets': 'Nawawalang Alaga',
    'Sightings': 'Mga Namataan',
    'Found a Pet': 'Nakitang Alaga',
    'Report Pet': 'Mag-ulat ng Alaga',
    'Log In': 'Mag-log In',
    'Log in': 'Mag-log in',
    'Log Out': 'Mag-log Out',
    'Account & Log Out': 'Account at Pag-log Out',
    'Verified Pet Guardian': 'Beripikadong Tagapag-alaga',
    'Guardian Profile': 'Profile ng Tagapag-alaga',
    'Hardware Specs': 'Mga Spec ng Hardware',
    'Portal Settings': 'Mga Setting ng Portal',
    'Community Pet Sightings': 'Mga Namataang Alaga sa Komunidad',
    'Main Navigation': 'Pangunahing Nabigasyon',
    'Account Menu': 'Menu ng Account',
    'Open menu': 'Buksan ang menu',
    'Toggle Theme': 'Palitan ang tema',
    'Toggle Language': 'Palitan ang wika',
    'Notifications': 'Mga Abiso',
    'Close': 'Isara',
    'Back': 'Bumalik',
    'Cancel': 'Kanselahin',
    'Change': 'Palitan',
    'Edit': 'I-edit',
    'Remove': 'Alisin',
    'Delete': 'Burahin',
    'Keep': 'Panatilihin',
    'Required': 'Kailangan',
    'Optional': 'Opsyonal',
    'or': 'o',
    'and': 'at',
    'Others': 'Iba pa',
    'Priority': 'Priyoridad',
    'Just now': 'Ngayon lang',
    'Sign in with Google': 'Mag-sign in gamit ang Google',
    'Continue with Google': 'Magpatuloy gamit ang Google',
    'Continue as Guest (Read-Only)': 'Magpatuloy bilang Bisita (Pagbasa Lamang)',
    'Browse as Guest': 'Mag-browse bilang Bisita',
    'Google Sign-In Required': 'Kailangan ang Google Sign-In',
    'Sign In with Google': 'Mag-sign in gamit ang Google',
    "By signing in, you agree to PawTrack's": 'Sa pag-sign in, sumasang-ayon ka sa',
    'Privacy Policy': 'Patakaran sa Privacy',
    'Terms of Service': 'Mga Tuntunin ng Serbisyo',

    // Login, sign-up, forgot and reset password
    'Welcome back': 'Maligayang pagbabalik',
    'Sign in to manage your pets and recovery alerts.': 'Mag-sign in para pamahalaan ang iyong mga alaga at abiso sa paghahanap.',
    'FULL NAME': 'BUONG PANGALAN',
    'EMAIL': 'EMAIL',
    'MOBILE NUMBER': 'MOBILE NUMBER',
    'PASSWORD': 'PASSWORD',
    'Forgot password?': 'Nakalimutan ang password?',
    'New to PawTrack?': 'Bago sa PawTrack?',
    'Already have an account?': 'May account ka na?',
    'Create an account': 'Gumawa ng account',
    'Create account': 'Gumawa ng account',
    'Create your account': 'Gawin ang iyong account',
    'Create your guardian account': 'Gawin ang iyong account bilang tagapag-alaga',
    'Shelters use these details to contact you if your pet is found.': 'Gagamitin ng mga shelter ang mga detalyeng ito para makipag-ugnayan sa iyo kapag nakita ang iyong alaga.',
    'From your Google account': 'Mula sa iyong Google account',
    'By continuing, you agree to our': 'Sa pagpapatuloy, sumasang-ayon ka sa aming',
    'Terms': 'Mga Tuntunin',
    'Found a pet?': 'May nakita kang alaga?',
    'Report it without signing in': 'I-ulat ito nang hindi nagsa-sign in',
    'Show password': 'Ipakita ang password',
    'Hide password': 'Itago ang password',
    'Email': 'Email',
    'Code': 'Code',
    'New password': 'Bagong password',
    'Forgot your password?': 'Nakalimutan ang iyong password?',
    "Enter your account email and we'll send you a 6-digit verification code.": 'Ilagay ang email ng iyong account at magpapadala kami ng 6-digit na verification code.',
    'Send code': 'Ipadala ang code',
    'We sent a 6-digit code to': 'Nagpadala kami ng 6-digit na code sa',
    '. It expires in 10 minutes.': '. Mag-e-expire ito sa loob ng 10 minuto.',
    'VERIFICATION CODE': 'VERIFICATION CODE',
    'Verify code': 'I-verify ang code',
    "Didn't get a code?": 'Walang natanggap na code?',
    'Send again': 'Ipadala muli',
    'Check your email': 'Tingnan ang iyong email',
    'Set a new password': 'Magtakda ng bagong password',
    'Code verified. Choose a new password for your PawTrack account.': 'Na-verify ang code. Pumili ng bagong password para sa iyong PawTrack account.',
    'NEW PASSWORD': 'BAGONG PASSWORD',
    'CONFIRM PASSWORD': 'KUMPIRMAHIN ANG PASSWORD',
    'At least 8 characters': 'Hindi bababa sa 8 character',
    'One uppercase letter (A-Z)': 'Isang malaking titik (A-Z)',
    'One lowercase letter (a-z)': 'Isang maliit na titik (a-z)',
    'One number (0-9)': 'Isang numero (0-9)',
    'One special character (!@#$%…)': 'Isang espesyal na character (!@#$%…)',
    'Both passwords match': 'Magkapareho ang dalawang password',
    'Update password': 'I-update ang password',
    'Password updated': 'Na-update ang password',
    'Your password has been changed. For your security, please log in again with your new password.': 'Napalitan na ang iyong password. Para sa iyong seguridad, mag-log in muli gamit ang bagong password.',

    // Terms and privacy
    'PawTrack Privacy Policy': 'Patakaran sa Privacy ng PawTrack',
    'PawTrack Terms of Service': 'Mga Tuntunin ng Serbisyo ng PawTrack',
    'I Understand': 'Naiintindihan Ko',
    'Accept & Close': 'Tanggapin at Isara',
    'Compliance: Philippine Data Privacy Act of 2012 (RA 10173), Animal Welfare Act (RA 8485 / RA 10631), & Google API Services User Data Policy.': 'Pagsunod sa: Data Privacy Act of 2012 (RA 10173), Animal Welfare Act (RA 8485 / RA 10631), at Google API Services User Data Policy.',
    '1. Google OAuth & Identity Authorization': '1. Google OAuth at Pagkilala sa Pagkakakilanlan',
    'PawTrack accesses basic Google profile attributes (Name, Email, Profile Picture) strictly to authenticate verified pet guardians, issue digital pass badges, and dispatch urgent municipal impound notifications. We do not sell or transfer your Google data to third parties.': 'Ginagamit ng PawTrack ang pangunahing impormasyon ng iyong Google profile (Pangalan, Email, Larawan) para lamang patunayan ang mga beripikadong tagapag-alaga, maglabas ng digital pass, at magpadala ng agarang abiso mula sa pound ng munisipyo. Hindi namin ibinebenta o inililipat ang iyong Google data sa ibang partido.',
    '2. NFC Tag Records': '2. Mga Tala ng NFC Tag',
    'Encrypted NFC tag serials and pet characteristics are recorded to enable municipal pound scanning grids and shelter intake matching across participating barangays.': 'Itinatala ang naka-encrypt na serial ng NFC tag at katangian ng alaga para magamit sa pag-scan ng pound ng munisipyo at pagtutugma sa pagtanggap ng shelter sa mga kalahok na barangay.',
    '3. 72-Hour Municipal Holding Countdown Alerts': '3. Mga Abiso sa 72-Oras na Palugit ng Munisipyo',
    'Upon shelter transponder scan, automated SMS and Email alerts are immediately sent to the registered guardian email to assist timely pet claiming within the legal holding period.': 'Kapag na-scan ng shelter ang transponder, awtomatikong ipapadala agad ang SMS at Email sa nakarehistrong tagapag-alaga para maangkin ang alaga sa loob ng legal na palugit.',
    '4. Location Privacy Shield': '4. Proteksyon sa Privacy ng Lokasyon',
    'Your exact residential address is shielded. Public lost & found sighting pins display general barangay vicinity coordinates to protect owner privacy.': 'Protektado ang eksaktong tirahan mo. Ang mga pin ng namataang alaga sa publiko ay nagpapakita lamang ng pangkalahatang lugar sa barangay para protektahan ang privacy ng may-ari.',
    '5. Full Standalone Policy Document': '5. Buong Dokumento ng Patakaran',
    'You can also view the permanent web document at': 'Maaari mo ring tingnan ang permanenteng dokumento sa',
    'Terms governing Pet Guardians, Animal Care Facilities, and Community Sighting Reporters.': 'Mga tuntuning sumasaklaw sa mga Tagapag-alaga, Pasilidad ng Animal Care, at mga Nag-uulat ng Namataang Alaga.',
    '1. Guardian Verification & Accuracy': '1. Pagbeberipika at Katumpakan ng Tagapag-alaga',
    'Guardians agree to provide valid contact details and attach verified NFC collar tags. False impoundment claims or fraudulent ownership assertions are strictly prohibited.': 'Sumasang-ayon ang mga tagapag-alaga na magbigay ng tamang detalye at maglakip ng beripikadong NFC collar tag. Mahigpit na ipinagbabawal ang maling pag-angkin o pandaraya sa pagmamay-ari.',
    '2. Municipal Pound Intake & Claiming Process': '2. Pagtanggap sa Pound at Proseso ng Pag-angkin',
    'Guardians must present legitimate proof (Government ID, Pet Vaccination Booklet, or PawTrack Digital Pass) at the municipal animal facility to authorize release before the 72-hour window expires.': 'Dapat magpakita ang mga tagapag-alaga ng tamang patunay (Government ID, Vaccination Booklet ng alaga, o PawTrack Digital Pass) sa pasilidad ng munisipyo para mapahintulutan ang pagpapalaya bago matapos ang 72 oras.',
    '3. Community Sighting Standards': '3. Pamantayan sa mga Ulat ng Komunidad',
    'Community sighting reports must contain authentic photos and accurate vicinity locations to prevent false alerts.': 'Dapat may totoong larawan at tamang lokasyon ang mga ulat ng komunidad para maiwasan ang maling abiso.',
    '4. Full Standalone Terms Document': '4. Buong Dokumento ng mga Tuntunin',
    'You can also view the permanent terms document at': 'Maaari mo ring tingnan ang permanenteng dokumento ng mga tuntunin sa',

    // Profile and guardian
    'Pet Guardian Profile': 'Profile ng Tagapag-alaga',
    'Edit Guardian Profile': 'I-edit ang Profile ng Tagapag-alaga',
    'Rescue Contact Phone': 'Numero ng Telepono para sa Pagsagip',
    'Registered Area & City': 'Nakarehistrong Lugar at Lungsod',
    'National Capital Region (NCR)': 'Pambansang Punong Rehiyon (NCR)',
    'Emergency Secondary Phone': 'Pangalawang Numero sa Emerhensiya',
    'None set': 'Wala pa',
    'Active Protected Pets': 'Mga Protektadong Alaga',
    'Edit Information': 'I-edit ang Impormasyon',
    'Close Profile': 'Isara ang Profile',
    'Profile Avatar': 'Larawan ng Profile',
    'Upload Photo': 'Mag-upload ng Larawan',
    'Reset Avatar': 'I-reset ang Larawan',
    'Full Guardian Name': 'Buong Pangalan ng Tagapag-alaga',
    'Used by animal shelters & good Samaritans to contact you if your pet is sighted.': 'Gagamitin ng mga shelter at mabubuting loob para makipag-ugnayan sa iyo kapag namataan ang iyong alaga.',
    'Registered Area / City': 'Nakarehistrong Lugar / Lungsod',
    'Emergency Secondary Contact (Optional)': 'Pangalawang Contact sa Emerhensiya (Opsyonal)',
    'Save Changes': 'I-save ang mga Pagbabago',
    'Portal & Notification Settings': 'Mga Setting ng Portal at Abiso',
    'Save Preferences': 'I-save ang mga Kagustuhan',

    // Register pet and reports
    'Pet Name *': 'Pangalan ng Alaga *',
    'Species *': 'Uri *',
    'Dog': 'Aso',
    'Cat': 'Pusa',
    'Other': 'Iba pa',
    'Which species? *': 'Anong uri? *',
    'Breed *': 'Lahi *',
    'Gender': 'Kasarian',
    'Male': 'Lalaki',
    'Female': 'Babae',
    'Age *': 'Edad *',
    'Unit': 'Yunit',
    'Years': 'Taon',
    'Months': 'Buwan',
    'Color & Markings': 'Kulay at Marka',
    'Change Photo': 'Palitan ang Larawan',
    'Photo Attached': 'May Nakalakip na Larawan',
    'Pet details': 'Detalye ng alaga',
    'Pet Photo': 'Larawan ng Alaga',
    'Photo of the pet': 'Larawan ng alaga',
    'No photo attached': 'Walang nakalakip na larawan',
    'Upload photo': 'Mag-upload ng larawan',
    'Take photo': 'Kumuha ng larawan',
    'Add a photo': 'Magdagdag ng larawan',
    'Use my current location': 'Gamitin ang kasalukuyan kong lokasyon',
    'Start scanning': 'Simulang mag-scan',
    'Continue without NFC': 'Magpatuloy nang walang NFC',
    'Go back and scan': 'Bumalik at mag-scan',
    'Tap Start scanning': 'Pindutin ang Simulang mag-scan',
    'Touch the tag to the back of your phone': 'Idikit ang tag sa likod ng iyong telepono',
    'Keep still until it finishes': 'Huwag igalaw hanggang matapos',
    'Hold the NFC tag to the back of your phone': 'Idikit ang NFC tag sa likod ng iyong telepono',
    'Register Pet': 'Irehistro ang Alaga',
    'NFC linked': 'May naka-link na NFC',
    'No NFC': 'Walang NFC',
    'Vaccinations': 'Mga Bakuna',
    'Add a vaccination': 'Magdagdag ng bakuna',
    'Add vaccination': 'Idagdag ang bakuna',
    'Vaccine *': 'Bakuna *',
    'Date given *': 'Petsa ng pagbigay *',
    'Next due': 'Susunod na bakuna',
    'Veterinarian': 'Beterinaryo',
    'Clinic': 'Klinika',
    'Report as missing': 'I-ulat bilang nawawala',
    'Mark as found': 'Markahan bilang natagpuan',
    'Report a missing pet': 'Mag-ulat ng nawawalang alaga',
    'Which pet is missing? *': 'Aling alaga ang nawawala? *',
    'Condition of the pet before it went missing *': 'Kondisyon ng alaga bago ito nawala *',
    'Pet Name & Description *': 'Pangalan at Paglalarawan ng Alaga *',
    'Describe Pet': 'Ilarawan ang Alaga',
    'Last seen & contact': 'Huling nakita at contact',
    'Last Seen Location *': 'Huling Nakitang Lokasyon *',
    'Last Seen Date & Time *': 'Petsa at Oras ng Huling Pagkakita *',
    'Emergency Contact Phone *': 'Numero ng Telepono sa Emerhensiya *',
    'Submit and Notify': 'Isumite at Mag-abiso',
    'Required fields. The pin on the map sets where the pet was last seen.': 'Mga kailangang sagutan. Ang pin sa mapa ang magtatakda kung saan huling nakita ang alaga.',
    'This pet has no NFC tag, so a recent photo and how it looked before it went missing help others recognise it.': 'Walang NFC tag ang alagang ito, kaya makakatulong ang bagong larawan at ang itsura nito bago nawala para makilala ito ng iba.',
    'About the pet': 'Tungkol sa alaga',
    'Which pet did you find? *': 'Aling alaga ang nakita mo? *',
    'Registered': 'Nakarehistro',
    'Unregistered': 'Hindi nakarehistro',
    'Animal Species *': 'Uri ng Hayop *',
    'Other Pet': 'Ibang Alaga',
    'Breed / Appearance *': 'Lahi / Itsura *',
    'Where & how to reach you': 'Saan at paano ka maabot',
    'Location Landmark / Street *': 'Landmark / Kalye *',
    'Your Contact Phone *': 'Iyong Numero ng Telepono *',
    'Message (optional)': 'Mensahe (opsyonal)',
    'Pinned Location:': 'Naka-pin na Lokasyon:',
    'Location': 'Lokasyon',
    'Photo': 'Larawan',

    // Sighting form
    'Have you seen this pet?': 'Nakita mo ba ang alagang ito?',
    'Your report goes straight to the owner. It only takes a minute, and every sighting helps bring a pet home.': 'Direktang mapupunta sa may-ari ang iyong ulat. Isang minuto lang ito, at bawat namataan ay nakakatulong na maiuwi ang alaga.',
    'MISSING PET': 'NAWAWALANG ALAGA',
    'Owner is searching': 'Hinahanap ng may-ari',
    'Where did you see it?': 'Saan mo ito nakita?',
    'Tap the map or drag the pin to the exact spot': 'Pindutin ang mapa o i-drag ang pin sa eksaktong lugar',
    'Click the map or drag the pin to set the exact spot': 'I-click ang mapa o i-drag ang pin para itakda ang eksaktong lugar',
    'A clear photo helps the owner confirm it is their pet': 'Malinaw na larawan ang tutulong sa may-ari na makumpirma kung alaga niya ito',
    'Take a live photo or upload from device': 'Kumuha ng larawan o mag-upload mula sa device',
    'When did you see it?': 'Kailan mo ito nakita?',
    'Pick a quick option or set the exact time': 'Pumili ng mabilis na opsyon o itakda ang eksaktong oras',
    '30 min ago': '30 minuto na ang nakalipas',
    '1 hour ago': '1 oras na ang nakalipas',
    '3 hours ago': '3 oras na ang nakalipas',
    'Yesterday': 'Kahapon',
    'What did you notice?': 'Ano ang napansin mo?',
    'Behaviour, condition or anything that stood out': 'Kilos, kondisyon, o anumang napansin',
    'Healthy and calm': 'Malusog at kalmado',
    'Scared': 'Takot',
    'Injured': 'Sugatan',
    'Wearing a collar': 'May suot na kuwelyo',
    'With someone': 'May kasama',
    'Your details': 'Iyong mga detalye',
    'So the owner can reach you. You can stay anonymous, but a phone number is needed': 'Para maabot ka ng may-ari. Maaari kang manatiling anonymous, pero kailangan ang numero ng telepono',
    'Your name': 'Iyong pangalan',
    'Stay anonymous': 'Manatiling anonymous',
    'Contact phone': 'Numero ng telepono',
    "Your name and phone are shared only with the pet's owner.": 'Ang pangalan at numero mo ay ibabahagi lamang sa may-ari ng alaga.',
    'Send sighting to owner': 'Ipadala ang namataan sa may-ari',
    'Report Sighting': 'Mag-ulat ng Namataan',
    'Report Pet Sighting': 'Mag-ulat ng Namataang Alaga',
    'Community Sighting Reports': 'Mga Ulat ng Komunidad sa Namataang Alaga',
    'Sort': 'Ayusin',
    'Newest First': 'Pinakabago Muna',
    'Oldest First': 'Pinakaluma Muna',
    'Confirmed First': 'Kumpirmado Muna',
    'Back to Active Sightings': 'Bumalik sa mga Aktibong Namataan',
    'Linked Missing Pet': 'Naka-link na Nawawalang Alaga',
    'Retrieve': 'Ibalik',
    'Verify Sighting': 'Beripikahin ang Namataan',
    'Archive': 'I-archive',
    'Owner Confirmed': 'Kinumpirma ng May-ari',
    'Possible Sighting': 'Posibleng Namataan',
    'Yes, This Is My Pet': 'Oo, Alaga Ko Ito',
    "No, This Isn't My Pet": 'Hindi, Hindi Ko Ito Alaga',
    'Close Window': 'Isara ang Window',

    // Found a pet page
    'Missing pets': 'Mga nawawalang alaga',
    'How it works': 'Paano ito gumagana',
    'Try again': 'Subukan muli',
    'Scan again': 'I-scan muli',
    'Change photo': 'Palitan ang larawan',
    'Best match': 'Pinakamalapit na tugma',
    'AI description': 'Paglalarawan ng AI',
    'Post a sighting': 'Mag-post ng namataan',
    'Where did you find it? *': 'Saan mo ito nakita? *',
    'Your phone number *': 'Iyong numero ng telepono *',
    'Notes': 'Mga tala',
    'Thank you for helping.': 'Salamat sa iyong pagtulong.',
    'Report another pet': 'Mag-ulat ng isa pang alaga',
    'See missing pets': 'Tingnan ang mga nawawalang alaga',
    'Add a photo of the pet': 'Magdagdag ng larawan ng alaga',
    'Scan for similar missing pets': 'Maghanap ng kahawig na nawawalang alaga',
    'Upload a photo of the pet you found.': 'Mag-upload ng larawan ng alagang nakita mo.',
    'PawTrack compares it with the pets reported missing and lists the ones that look similar.': 'Ihahambing ito ng PawTrack sa mga alagang naiulat na nawawala at ililista ang mga kahawig nito.',
    'Pick the matching pet and send its owner your location and number.': 'Piliin ang tugmang alaga at ipadala sa may-ari ang iyong lokasyon at numero.',
    'Reading the photo, then comparing it with the pets reported missing...': 'Binabasa ang larawan, saka ikinukumpara sa mga alagang naiulat na nawawala...',
    'None of these. Post it as a sighting instead.': 'Wala sa mga ito. I-post na lang bilang namataan.',
    'Tap the pet you found. Scores are estimates, so check the details.': 'Piliin ang alagang nakita mo. Tantiya lamang ang mga score, kaya suriin ang mga detalye.',

    // Map and details
    'Last seen': 'Huling nakita',
    'Directions': 'Mga Direksyon',
    'Seen this pet?': 'Nakita mo ba ang alagang ito?',
    'Show all': 'Ipakita lahat',
    'Layers': 'Mga Layer',
    'Map': 'Mapa',
    'Satellite': 'Satelayt',
    'Hybrid': 'Hybrid',
    'Dark': 'Madilim',
    'Missing only': 'Nawawala lamang',
    'Last seen only': 'Huling nakita lamang',
    'Your Location': 'Iyong Lokasyon',
    'Exit Navigation': 'Lumabas sa Nabigasyon',
    'Search by Photo': 'Hanapin gamit ang Larawan',
    'Search Missing Pets by Photo': 'Hanapin ang Nawawalang Alaga gamit ang Larawan',
    'Find Matches': 'Hanapin ang mga Tugma',
    'Tap to choose or take a photo': 'Pindutin para pumili o kumuha ng larawan',
    'Analyzing photo...': 'Sinusuri ang larawan...',
    'View on Map': 'Tingnan sa Mapa',
    'Call Finder': 'Tawagan ang Nakakita',

    // Owner guide
    'PawTrack Owner System Guide': 'Gabay sa Sistema ng PawTrack para sa May-ari',
    'Complete step-by-step instructions: What to do Before, During, and After.': 'Kumpletong gabay: Ano ang gagawin Bago, Habang, at Pagkatapos.',
    'PHASE 1': 'YUGTO 1',
    'PHASE 2': 'YUGTO 2',
    'PHASE 3': 'YUGTO 3',
    'BEFORE: Preventive Protection & Registration': 'BAGO: Proteksyon at Pagpaparehistro',
    'DURING: When Pet is Missing or Impounded': 'HABANG: Kapag Nawawala o Na-impound ang Alaga',
    'AFTER: Safe Claiming, Reunion & Follow-up': 'PAGKATAPOS: Ligtas na Pag-angkin at Pagkikita',
    'Close Guide': 'Isara ang Gabay',

    // Pets page and pet details
    'My Pets': 'Aking mga Alaga',
    'Tap a pet to see its details and keep its vaccination records.': 'Pindutin ang alaga para makita ang detalye at ingatan ang talaan ng bakuna.',
    'No vaccines recorded': 'Walang naitalang bakuna',
    'No vaccinations recorded yet. Add the first one below.': 'Wala pang naitalang bakuna. Idagdag ang una sa ibaba.',
    'Safe': 'Ligtas',
    'Missing': 'Nawawala',
    'Impounded': 'Nasa Pound',
    'Reunited': 'Nakauwi Na',
    'Species': 'Uri',
    'Breed': 'Lahi',
    'Age': 'Edad',
    'Color & markings': 'Kulay at marka',
    'Enter the vaccine name.': 'Ilagay ang pangalan ng bakuna.',
    'Pick a date that is not in the future.': 'Pumili ng petsang hindi pa dumarating.',
    'Next due must be after the date given.': 'Dapat mas huli ang susunod na bakuna kaysa sa petsa ng pagbigay.',
    '(optional)': '(opsyonal)',
    'Notes (optional)': 'Mga tala (opsyonal)',
    'Marked as found. Glad they are safe.': 'Namarkahan bilang natagpuan. Mabuti at ligtas sila.',
    'Could not load your pets': 'Hindi ma-load ang iyong mga alaga',
    'Check your connection and try again.': 'Suriin ang iyong koneksyon at subukan muli.',
    'Open in Google Maps': 'Buksan sa Google Maps',
    'Show Directions': 'Ipakita ang Direksyon',
    'Close Simulator': 'Isara ang Simulator',
    'Admin Console ↗': 'Admin Console ↗',
    'Receive push & SMS notifications when your pet is scanned.': 'Makatanggap ng push at SMS na abiso kapag na-scan ang iyong alaga.',
    'Daily SMS reminders until pet is claimed from pound.': 'Araw-araw na SMS paalala hanggang makuha ang alaga mula sa pound.',
    'Alerts when missing pets are sighted in your barangay.': 'Mga abiso kapag may nawawalang alagang namataan sa iyong barangay.',
    'Upload a photo of a pet. AI reads its species, breed, colors, and markings, then compares them against every pet currently reported missing.': 'Mag-upload ng larawan ng alaga. Babasahin ng AI ang uri, lahi, kulay, at marka nito, saka ihahambing sa bawat alagang naiulat na nawawala.',
    'SkinWise-Style AI Multi-Trait Pet Matcher': 'AI na Panghanap ng Kahawig na Alaga',
    'Redeeming Pet:': 'Tutubusing Alaga:',
    'Check all official credentials presented at the facility intake window.': 'Suriin ang lahat ng opisyal na dokumentong ipinakita sa bintana ng pagtanggap ng pasilidad.',
    'Official Fee Receipt / OR Number': 'Opisyal na Resibo / OR Number',
    '2. Pet Registration / Anti-Rabies Vaccination Book': '2. Rehistro ng Alaga / Aklat ng Bakuna Laban sa Rabies',
    'Search by pet name, breed, or barangay...': 'Maghanap ayon sa pangalan, lahi, o barangay...',
    'Last Seen': 'Huling Nakita',
    'Found': 'Nakita',
    'Sightings Only': 'Mga Namataan Lamang',
    'Reporting': 'Ang pag-uulat kay',
    'Pet': 'Alaga',
    'as missing activates real-time alert broadcasts on the public recovery board and alerts animal facilities.': 'bilang nawawala ay magpapadala ng real-time na abiso sa pampublikong recovery board at aabisuhan ang mga pasilidad ng hayop.',
    'To register a new pet, issue municipal NFC collar transponders, and manage emergency recovery alerts, you must first sign in with your Google account.': 'Para magrehistro ng bagong alaga, mag-isyu ng NFC collar tag ng munisipyo, at mamahala ng mga abiso sa paghahanap, kailangan mo munang mag-sign in gamit ang iyong Google account.',
    'Clear photo of the spotted pet helps the guardian verify immediately': 'Malinaw na larawan ng namataang alaga ang tutulong sa tagapag-alaga na makumpirma agad',
    'Your pet': 'Alaga mo',
    'Scan a pet': 'I-scan ang alaga',
    'Choose a missing pet': 'Pumili ng nawawalang alaga',
    'You reported': 'Iniulat mo',
    'Is this your pet? *': 'Alaga mo ba ito? *',
    "Yes, it's my pet": 'Oo, alaga ko',
    "It just isn't registered yet": 'Hindi pa lang nakarehistro',
    "No, someone else's": 'Hindi, sa iba',
    'A neighbour\'s pet, or a stray I look after': 'Alaga ng kapitbahay, o ligaw na hayop na inaalagaan ko',
    'Either way, whoever finds it will notify you.': 'Alinman dito, ikaw ang aabisuhan ng makakakita.',
    'Mark as found': 'Markahang nakita na',
    'Not yet': 'Hindi pa',
    'Yes, mark as found': 'Oo, nakita na',
    'The missing alert comes off the map and the missing list.': 'Mawawala ang abiso sa mapa at sa listahan ng nawawala.',
    'The report is closed, so finders stop sending sightings.': 'Isasara ang ulat, kaya hihinto na ang pagpapadala ng mga namataan.',
    'Private to the owner': 'Para lang sa may-ari',
    'Starts as a possible sighting': 'Magsisimula bilang posibleng namataan',
    'It becomes confirmed once the owner checks your photo and says it is their pet.': 'Makukumpirma ito kapag nasuri ng may-ari ang iyong larawan at sinabing alaga nila ito.',
    'Initial Status:': 'Unang Katayuan:',
    'Strictly recorded as': 'Itinatala bilang',
    'until visually verified by the registered guardian.': 'hanggang makumpirma sa paningin ng nakarehistrong tagapag-alaga.',
    'Owner Verification: Community Pet Sighting': 'Beripikasyon ng May-ari: Namataang Alaga sa Komunidad',
    'Compare your registered pet profile with the community sighting report to verify identity.': 'Ihambing ang profile ng iyong rehistradong alaga sa ulat ng komunidad para makumpirma kung ito nga.',
    'Current Report Status:': 'Kasalukuyang Katayuan ng Ulat:'
  };

  // Strings built from parts ("Persian · Cat · 4 years", "3 vaccines recorded"): translate each piece
  const WORDS = { year: 'taon', years: 'taon', month: 'buwan', months: 'buwan', mo: 'buwan', day: 'araw', days: 'araw' };
  const PATTERNS = [
    [/^Last Seen \((\d+)\)$/, (m) => `Huling Nakita (${m[1]})`],
    [/^(.+) · Last seen near (.+)$/, (m) => `${m[1]} · Huling nakita malapit sa ${m[2]}`],
    [/^(\d+) (years?|months?|days?)(?: (\d+) mo)?$/, (m) => `${m[1]} ${WORDS[m[2]]}${m[3] ? ` ${m[3]} buwan` : ''}`],
    [/^(\d+) vaccines? recorded$/, (m) => `${m[1]} bakunang naitala`],
    [/^Due in (\d+) days?$/, (m) => `Dapat sa loob ng ${m[1]} araw`],
    [/^Next due (.+)$/, (m) => `Susunod na bakuna ${m[1]}`],
    [/^Given (.+)$/, (m) => `Binigay noong ${m[1]}`],
    [/^(\d+) Registered Pets?$/, (m) => `${m[1]} Rehistradong Alaga`],
    [/^(.+) added\.$/, (m) => `Naidagdag ang ${m[1]}.`],
    [/^Delete (.+)$/, (m) => `Burahin ang ${m[1]}`],
    [/^(.+) is reported missing\. Anyone who taps the tag sees an alert\.$/, (m) => `Naiulat na nawawala si ${m[1]}. Sinumang mag-tap ng tag ay makakakita ng abiso.`]
  ];

  function phrase(text) {
    if (FIL[text]) return FIL[text];
    for (const [re, fn] of PATTERNS) {
      const m = text.match(re);
      if (m) return fn(m);
    }
    if (text.indexOf(' · ') > 0) {
      const parts = text.split(' · ');
      const out = parts.map((x) => phrase(x) || x);
      if (out.some((x, i) => x !== parts[i])) return out.join(' · ');
    }
    return undefined;
  }

  const ATTRS = ['placeholder', 'title', 'aria-label'];
  const originals = new Map();      // text node -> { orig: English text, tr: the Tagalog text written in }
  const attrOriginals = new Map();  // element -> { attr: { orig, tr } }
  let observer = null;
  let active = false;

  const lookup = (raw) => phrase(raw.replace(/\s+/g, ' ').trim());

  function translateTextNode(node) {
    if (originals.has(node)) return;
    const raw = node.nodeValue;
    if (!raw || !raw.trim()) return;
    const found = lookup(raw);
    if (!found) return;
    const lead = raw.match(/^\s*/)[0];
    const trail = raw.match(/\s*$/)[0];
    const tr = lead + found + trail;
    originals.set(node, { orig: raw, tr });
    node.nodeValue = tr;
  }

  function translateAttrs(el) {
    ATTRS.forEach((attr) => {
      if (!el.hasAttribute || !el.hasAttribute(attr)) return;
      const saved = attrOriginals.get(el);
      if (saved && attr in saved) return;
      const found = lookup(el.getAttribute(attr));
      if (!found) return;
      attrOriginals.set(el, Object.assign(saved || {}, { [attr]: { orig: el.getAttribute(attr), tr: found } }));
      el.setAttribute(attr, found);
    });
  }

  function translateTree(root) {
    if (!root) return;
    if (root.nodeType === Node.TEXT_NODE) {
      if (root.parentNode && !/^(SCRIPT|STYLE|TEXTAREA)$/.test(root.parentNode.nodeName)) translateTextNode(root);
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE || /^(SCRIPT|STYLE)$/.test(root.nodeName)) return;
    translateAttrs(root);
    root.querySelectorAll('[placeholder],[title],[aria-label]').forEach(translateAttrs);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (/^(SCRIPT|STYLE|TEXTAREA)$/.test(n.parentNode.nodeName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT)
    });
    let n;
    while ((n = walker.nextNode())) translateTextNode(n);
  }

  function restoreAll() {
    originals.forEach((rec, node) => { if (node.isConnected) node.nodeValue = rec.orig; });
    originals.clear();
    attrOriginals.forEach((attrs, el) => {
      if (!el.isConnected) return;
      Object.keys(attrs).forEach((attr) => el.setAttribute(attr, attrs[attr].orig));
    });
    attrOriginals.clear();
  }

  function start() {
    if (observer) return;
    observer = new MutationObserver((mutations) => {
      mutations.forEach((m) => {
        if (m.type === 'childList') m.addedNodes.forEach(translateTree);
        else if (m.type === 'characterData') {
          // Ignore our own write; if the page rewrote the text itself, translate the new text
          const rec = originals.get(m.target);
          if (rec && rec.tr === m.target.nodeValue) return;
          originals.delete(m.target);
          translateTree(m.target);
        } else if (m.type === 'attributes') {
          const saved = attrOriginals.get(m.target);
          const rec = saved && saved[m.attributeName];
          if (rec && rec.tr === m.target.getAttribute(m.attributeName)) return;
          if (saved) delete saved[m.attributeName];
          translateAttrs(m.target);
        }
      });
    });
    observer.observe(document.body, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ATTRS });
  }

  function stop() {
    if (observer) { observer.disconnect(); observer = null; }
  }

  window.pawPhrases = {
    // Called by the i18n manager whenever the language is applied
    sync(lang) {
      if (!document.body) return;
      if (lang === 'fil') {
        active = true;
        stop();
        translateTree(document.body);
        start();
      } else if (active) {
        active = false;
        stop();
        restoreAll();
      }
    }
  };
})();
