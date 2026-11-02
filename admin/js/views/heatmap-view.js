/**
 * PawTrack Admin — Complete Heatmap Analysis & Lost Pet Cluster Intelligence Dashboard
 * Full Panoramic Google Maps GIS Telemetry, KPI Summary Cards, Multi-filter Toolbars,
 * Hotspot Rankings, Reports Over Time Chart, Sector Metrics Strip, and Incident Locations Table with Fly-to-Location.
 */

window.HeatmapView = {
  mapInstance: null,
  heatLayer: null,
  markersLayer: null,
  tileLayerInstance: null,

  // State filters
  selectedDateRange: 'all', // 'all' | 'today' | '7d' | '30d' | 'custom'
  selectedLayer: 'roadmap', // 'roadmap' | 'satellite' | 'terrain' | 'osm'
  selectedAnimal: 'all', // 'all' | 'dog' | 'cat' | 'other'
  selectedStatus: 'all', // 'all' | 'lost' | 'sighting' | 'found' | 'impounded'
  selectedDistrict: 'all', // 'all' | 'District 1' | 'District 2' | ...
  searchQuery: '',
  currentTimeframe: 'daily', // 'daily' | 'weekly' | 'monthly'
  sortBy: 'date', // 'date' | 'name' | 'location' | 'status'
  currentPage: 1,
  pageSize: 8,
  searchLocationMarker: null,

  // Quezon City 6 Legislative Districts Geographic Centers & Bounds
  qcDistricts: {
    'all': {
      name: 'All Districts (Quezon City)',
      center: [14.6760, 121.0550],
      zoom: 12.8,
      description: 'Whole Quezon City (Districts 1 to 6)'
    },
    'District 1': {
      name: 'District 1 (West QC)',
      center: [14.6480, 121.0180],
      zoom: 14.5,
      description: 'SFDM, Project 6/7/8, La Loma, Sto. Domingo, Bungad, Phil-Am, West Triangle'
    },
    'District 2': {
      name: 'District 2 (Northeast QC)',
      center: [14.6945, 121.0890],
      zoom: 14.0,
      description: 'Batasan Hills, Commonwealth, Holy Spirit, Payatas, Bagong Silangan'
    },
    'District 3': {
      name: 'District 3 (East QC)',
      center: [14.6320, 121.0720],
      zoom: 14.5,
      description: 'Cubao, Loyola Heights, Matandang Balara, Libis, Blue Ridge, Ugong Norte'
    },
    'District 4': {
      name: 'District 4 (Central & South QC)',
      center: [14.6380, 121.0340],
      zoom: 14.5,
      description: 'Diliman, UP Campus, Teachers Village, New Manila, South Triangle, Scout Area, Kamuning'
    },
    'District 5': {
      name: 'District 5 (Novaliches & Fairview)',
      center: [14.7150, 121.0450],
      zoom: 14.0,
      description: 'Novaliches Proper, Fairview, Greater Lagro, San Bartolome, Gulod, Bagbag'
    },
    'District 6': {
      name: 'District 6 (North Central QC)',
      center: [14.6780, 121.0480],
      zoom: 14.5,
      description: 'Tandang Sora, Sauyo, Talipapa, Culiat, Pasong Tamo, Baesa, Balintawak'
    }
  },

  // Quezon City Official Barangays by District
  qcBarangaysByDistrict: {
    'District 1': [
      'Alicia', 'Bagong Pag-asa', 'Balingasa', 'Bungad', 'Damar', 'Damayan',
      'Del Monte', 'Katipunan', 'Lourdes', 'Maharlika', 'Manresa', 'Mariblo',
      'Masambong', 'N.S. Amoranto', 'Nayong Kanluran', 'Paang Bundok', 'Pag-ibig sa Nayon',
      'Paltok', 'Paraiso', 'Phil-Am', 'Project 6', 'Ramon Magsaysay', 'Saint Peter',
      'Salvacion', 'San Antonio', 'San Francisco del Monte (SFDM)', 'San Isidro Labrador',
      'San Jose', 'Santa Cruz', 'Santa Teresita', 'Santo Cristo', 'Santo Domingo',
      'Sienna', 'Talayan', 'Vasra', 'Veterans Village', 'West Triangle'
    ],
    'District 2': [
      'Batasan Hills', 'Commonwealth', 'Holy Spirit', 'Payatas', 'Bagong Silangan'
    ],
    'District 3': [
      'Amihan', 'Bagumbayan', 'Bagumbuhay', 'Bayanihan', 'Blue Ridge A', 'Blue Ridge B',
      'Camp Aguinaldo', 'Claro', 'Dioquino Zobel', 'Duyan-Duyan', 'E. Rodriguez',
      'East Kamias', 'Escopa I', 'Escopa II', 'Escopa III', 'Escopa IV', 'Libis / Eastwood',
      'Loyola Heights', 'Mangga', 'Marilag', 'Masagana', 'Matandang Balara', 'Milagrosa',
      'Pansol', 'Quirino 2-A', 'Quirino 2-B', 'Quirino 2-C', 'Quirino 3-A', 'Saint Ignatius',
      'San Roque (Cubao)', 'Silangan', 'Socorro (Cubao)', 'Tagumpay', 'Ugong Norte',
      'Villa Maria Clara', 'West Kamias', 'White Plains'
    ],
    'District 4': [
      'Bagong Lipunan ng Crame', 'Botocan', 'Central', 'Damayang Lagi', 'Diliman',
      'Don Manuel', 'Doña Aurora', 'Doña Imelda', 'Doña Josefa', 'Horseshoe',
      'Immaculate Conception', 'Kalusugan', 'Kamuning', 'Kaunlaran', 'Kristong Hari',
      'Krus na Ligas', 'Laging Handa', 'Malaya', 'Mariana', 'New Manila', 'Obrero',
      'Old Capitol Site', 'Paligsahan', 'Pinyahan', 'Pinagkaisahan', 'Roxas', 'Sacred Heart',
      'San Isidro', 'San Martin de Porres', 'San Vicente', 'Santol', 'Scout Area / South Triangle',
      'Sikatuna Village', 'Santo Niño', 'Tatalon', 'Teachers Village East', 'Teachers Village West',
      'UP Campus', 'UP Village', 'Valencia'
    ],
    'District 5': [
      'Bagbag', 'Capri', 'Fairview', 'Greater Lagro', 'Gulod', 'Kaligayahan',
      'Nagkaisang Nayon', 'North Fairview', 'Novaliches Proper', 'Pasong Putik Proper',
      'San Agustin', 'San Bartolome', 'Santa Lucia', 'Santa Monica'
    ],
    'District 6': [
      'Apolonio Samson', 'Baesa', 'Balintawak', 'Balong Bato', 'Culiat', 'New Era',
      'Pasong Tamo', 'Sangandaan', 'Sauyo', 'Talipapa', 'Tandang Sora', 'Unang Sigaw'
    ]
  },

  // Landmark Directory for Instant Geocoding & Direct Search
  landmarksDirectory: [
    { name: 'Ever Gotesco Commonwealth', aliases: ['ever gotesco', 'ever', 'gotesco', 'ever commonwealth', 'ever mall'], lat: 14.6812, lng: 121.0825, desc: 'Commonwealth Ave, Batasan Hills, District 2, QC', type: 'mall' },
    { name: 'Batasang Pambansa Complex', aliases: ['batasan', 'batasan hills', 'batasang pambansa', 'batasan complex', 'congress'], lat: 14.6934, lng: 121.0954, desc: 'Batasan Hills, District 2, QC', type: 'government' },
    { name: 'Batasan Hills National High School', aliases: ['batasan school', 'batasan high school', 'batasan nhs'], lat: 14.6908, lng: 121.0995, desc: 'IBP Road, Batasan Hills, District 2, QC', type: 'school' },
    { name: 'Commonwealth Market', aliases: ['commonwealth', 'commonwealth ave', 'commonwealth market'], lat: 14.7046, lng: 121.0792, desc: 'Commonwealth, District 2, QC', type: 'market' },
    { name: 'Sandiganbayan Centennial Bldg', aliases: ['sandigan', 'sandiganbayan', 'sandigan market', 'centennial bldg'], lat: 14.6852, lng: 121.0788, desc: 'Commonwealth Ave, District 2, QC', type: 'government' },
    { name: 'SM City North EDSA', aliases: ['sm north', 'sm north edsa', 'sm city north edsa'], lat: 14.6565, lng: 121.0315, desc: 'Bago Bantay, District 1, QC', type: 'mall' },
    { name: 'Shopwise Commonwealth', aliases: ['shopwise', 'shopwise commonwealth', 'don antonio'], lat: 14.6750, lng: 121.0780, desc: 'Don Antonio Heights, Holy Spirit, District 2, QC', type: 'shopping' },
    { name: 'Holy Spirit Drive', aliases: ['holy spirit', 'holy spirit drive'], lat: 14.6865, lng: 121.0682, desc: 'Holy Spirit, District 2, QC', type: 'residential' },
    { name: 'Payatas / Lupang Pangako', aliases: ['payatas', 'lupang pangako', 'white mosque'], lat: 14.7118, lng: 121.1037, desc: 'Payatas, District 2, QC', type: 'residential' },
    { name: 'Bagong Silangan Barangay Hall', aliases: ['bagong silangan', 'silangan'], lat: 14.7081, lng: 121.1152, desc: 'Bagong Silangan, District 2, QC', type: 'barangay' },
    { name: 'Bagbag Novaliches', aliases: ['bagbag', 'novaliches', 'quirino hwy'], lat: 14.7005, lng: 121.0380, desc: 'Quirino Highway, Bagbag, District 5, QC', type: 'residential' },
    { name: 'UP Diliman Campus', aliases: ['up diliman', 'up', 'university of the philippines', 'diliman'], lat: 14.6538, lng: 121.0685, desc: 'UP Diliman, District 4, QC', type: 'university' },
    { name: 'SM City Fairview', aliases: ['fairview', 'sm fairview', 'sm city fairview'], lat: 14.7335, lng: 121.0583, desc: 'Quirino Hwy, Novaliches, District 5, QC', type: 'mall' },
    { name: 'Tandang Sora', aliases: ['tandang sora', 'ts', 'culiat'], lat: 14.6710, lng: 121.0450, desc: 'District 6, Quezon City', type: 'residential' },
    { name: 'Sauyo Road', aliases: ['sauyo', 'sauyo road'], lat: 14.6950, lng: 121.0420, desc: 'Sauyo, District 6, QC', type: 'residential' },
    { name: 'Doña Carmen Heights', aliases: ['dona carmen', 'doña carmen', 'dona carmen heights'], lat: 14.6980, lng: 121.0750, desc: 'Commonwealth Ave, District 2, QC', type: 'subdivision' },
    { name: 'Spring Valley Subdivision', aliases: ['spring valley', 'spring valley subdivision'], lat: 14.7020, lng: 121.0850, desc: 'Bagong Silangan, District 2, QC', type: 'subdivision' },
    { name: 'St. Peter Parish Church', aliases: ['st peter', 'st. peter', 'st peter church', 'st peter parish'], lat: 14.6830, lng: 121.0820, desc: 'Commonwealth Ave, District 2, QC', type: 'church' },
    { name: 'Quezon City Hall / Elliptical', aliases: ['qc hall', 'quezon city hall', 'elliptical road', 'circle'], lat: 14.6465, lng: 121.0494, desc: 'Diliman, District 4, Quezon City', type: 'landmark' },
    { name: 'Araneta City Cubao', aliases: ['cubao', 'araneta center', 'araneta city', 'gateway'], lat: 14.6210, lng: 121.0530, desc: 'Socorro, Cubao, District 3, QC', type: 'commercial' },
    { name: 'San Francisco del Monte', aliases: ['sfdm', 'san francisco del monte', 'del monte'], lat: 14.6480, lng: 121.0180, desc: 'SFDM, District 1, QC', type: 'residential' }
  ],

  // Incident Records Database (Strictly Quezon City)
  incidentsData: [
    {
      id: 'inc-1789014867597',
      name: 'Bruno',
      species: 'Dog',
      breed: 'Golden Retriever',
      speciesTag: 'Dog · Golden Retriever',
      status: 'lost',
      district: 'District 2',
      barangay: 'Batasan Hills',
      city: 'Quezon City',
      location: 'Commonwealth Ave. cor. Batasan Rd., QC',
      contact: 'Elena Gomez',
      phone: '+63 917 555 1212',
      lat: 14.6865,
      lng: 121.0874,
      date: 'Sep 6, 2026',
      time: '14:30',
      timeWindow: 'Afternoon (2 PM)',
      avatar: '🐕',
      color: '#ea580c'
    },
    {
      id: 'inc-1789014867598',
      name: 'Ginger Cat',
      species: 'Cat',
      breed: 'Domestic Ginger',
      speciesTag: 'Cat · Domestic Ginger',
      status: 'sighting',
      district: 'District 4',
      barangay: 'Teachers Village',
      city: 'Quezon City',
      location: 'Malingap St., Teachers Village, Diliman, QC',
      contact: 'Grace Uy Tan',
      phone: '+63 919 222 3344',
      lat: 14.6420,
      lng: 121.0580,
      date: 'Sep 5, 2026',
      time: '18:15',
      timeWindow: 'Evening (6 PM)',
      avatar: '🐈',
      color: '#2563eb'
    },
    {
      id: 'inc-1789014867599',
      name: 'Stray Brown Aspin',
      species: 'Dog',
      breed: 'Aspin / Mixed',
      speciesTag: 'Dog · Aspin',
      status: 'lost',
      district: 'District 2',
      barangay: 'Commonwealth',
      city: 'Quezon City',
      location: 'Don Fabian St., Commonwealth, Quezon City',
      contact: 'Citizen Report',
      phone: '+63 920 111 7722',
      lat: 14.6975,
      lng: 121.0890,
      date: 'Sep 5, 2026',
      time: '11:00',
      timeWindow: 'Morning (11 AM)',
      avatar: '🐕',
      color: '#ea580c'
    },
    {
      id: 'inc-1789014867600',
      name: 'Koko',
      species: 'Dog',
      breed: 'Pomeranian',
      speciesTag: 'Dog · Pomeranian',
      status: 'lost',
      district: 'District 2',
      barangay: 'Payatas',
      city: 'Quezon City',
      location: 'Lupang Pangako, Payatas, Quezon City',
      contact: 'Carlos Maza',
      phone: '+63 918 444 3300',
      lat: 14.7118,
      lng: 121.1037,
      date: 'Sep 4, 2026',
      time: '16:45',
      timeWindow: 'Evening (4 PM)',
      avatar: '🐕',
      color: '#ea580c'
    },
    {
      id: 'inc-1789014867601',
      name: 'Max',
      species: 'Dog',
      breed: 'Labrador Retriever',
      speciesTag: 'Dog · Labrador',
      status: 'lost',
      district: 'District 2',
      barangay: 'Batasan Hills',
      city: 'Quezon City',
      location: 'Batasang Pambansa Complex, Quezon City',
      contact: 'Gabriel Cruz',
      phone: '+63 917 882 1920',
      lat: 14.6934,
      lng: 121.0954,
      date: 'Sep 4, 2026',
      time: '20:10',
      timeWindow: 'Night (8 PM)',
      avatar: '🐕',
      color: '#ea580c'
    },
    {
      id: 'inc-1789014867602',
      name: 'Luna',
      species: 'Cat',
      breed: 'British Shorthair',
      speciesTag: 'Cat · British Shorthair',
      status: 'lost',
      district: 'District 2',
      barangay: 'Commonwealth',
      city: 'Quezon City',
      location: 'Commonwealth Market, Quezon City',
      contact: 'Barangay Tanod Desk',
      phone: '+63 919 771 8290',
      lat: 14.7046,
      lng: 121.0792,
      date: 'Sep 3, 2026',
      time: '09:20',
      timeWindow: 'Morning (9 AM)',
      avatar: '🐈',
      color: '#ea580c'
    },
    {
      id: 'inc-1789014867603',
      name: 'Barnaby',
      species: 'Dog',
      breed: 'Beagle',
      speciesTag: 'Dog · Beagle',
      status: 'lost',
      district: 'District 2',
      barangay: 'Commonwealth',
      city: 'Quezon City',
      location: 'Sandiganbayan Centennial Bldg / Sandigan Market',
      contact: 'Ricardo Dalisay',
      phone: '+63 922 904 1234',
      lat: 14.6852,
      lng: 121.0788,
      date: 'Sep 3, 2026',
      time: '18:00',
      timeWindow: 'Evening (6 PM)',
      avatar: '🐕',
      color: '#ea580c'
    },
    {
      id: 'inc-1789014867604',
      name: 'Mochi',
      species: 'Dog',
      breed: 'Shih Tzu',
      speciesTag: 'Dog · Shih Tzu',
      status: 'lost',
      district: 'District 2',
      barangay: 'Batasan Hills',
      city: 'Quezon City',
      location: 'Batasan Hills National High School, QC',
      contact: 'Maria Santos',
      phone: '+63 920 449 1022',
      lat: 14.6908,
      lng: 121.0995,
      date: 'Sep 2, 2026',
      time: '11:15',
      timeWindow: 'Morning (11 AM)',
      avatar: '🐕',
      color: '#ea580c'
    },
    {
      id: 'inc-1789014867605',
      name: 'Rex',
      species: 'Dog',
      breed: 'German Shepherd',
      speciesTag: 'Dog · German Shepherd',
      status: 'lost',
      district: 'District 5',
      barangay: 'Bagbag',
      city: 'Quezon City',
      location: 'Quirino Highway, Bagbag, Novaliches, QC',
      contact: 'Ernesto Ramos',
      phone: '+63 922 777 8899',
      lat: 14.7005,
      lng: 121.0380,
      date: 'Sep 1, 2026',
      time: '15:30',
      timeWindow: 'Afternoon (3 PM)',
      avatar: '🐕',
      color: '#ea580c'
    },
    {
      id: 'inc-1789014867606',
      name: 'Cleo',
      species: 'Cat',
      breed: 'Persian',
      speciesTag: 'Cat · Persian',
      status: 'found',
      district: 'District 2',
      barangay: 'Holy Spirit',
      city: 'Quezon City',
      location: 'Holy Spirit Drive, Holy Spirit, QC',
      contact: 'Corazon Aquino St Resident',
      phone: '+63 928 109 2831',
      lat: 14.6865,
      lng: 121.0682,
      date: 'Aug 30, 2026',
      time: '10:30',
      timeWindow: 'Morning (10 AM)',
      avatar: '🐈',
      color: '#2563eb'
    },
    {
      id: 'inc-1789014867607',
      name: 'Rocky',
      species: 'Dog',
      breed: 'Rottweiler',
      speciesTag: 'Dog · Rottweiler',
      status: 'sighting',
      district: 'District 2',
      barangay: 'Bagong Silangan',
      city: 'Quezon City',
      location: 'Bagong Silangan Barangay Hall vicinity, QC',
      contact: 'Barangay Patrol 4',
      phone: '+63 920 123 4567',
      lat: 14.7081,
      lng: 121.1152,
      date: 'Aug 29, 2026',
      time: '12:00',
      timeWindow: 'Noon (12 PM)',
      avatar: '🐕',
      color: '#2563eb'
    },
    {
      id: 'inc-1789014867608',
      name: 'Siamese Kitten',
      species: 'Cat',
      breed: 'Siamese',
      speciesTag: 'Cat · Siamese',
      status: 'found',
      district: 'District 2',
      barangay: 'Payatas',
      city: 'Quezon City',
      location: 'Payatas White Mosque Area, QC',
      contact: 'Community Watch Desk',
      phone: '+63 917 449 9988',
      lat: 14.7150,
      lng: 121.1012,
      date: 'Aug 28, 2026',
      time: '15:20',
      timeWindow: 'Afternoon (3 PM)',
      avatar: '🐈',
      color: '#2563eb'
    },
    {
      id: 'inc-1789014867609',
      name: 'Bulldog Stray',
      species: 'Dog',
      breed: 'Bulldog',
      speciesTag: 'Dog · Bulldog',
      status: 'lost',
      district: 'District 2',
      barangay: 'Batasan Hills',
      city: 'Quezon City',
      location: 'Kalayaan B St, Batasan Hills, QC',
      contact: 'Teresa Lim',
      phone: '+63 919 889 0011',
      lat: 14.6918,
      lng: 121.0925,
      date: 'Aug 27, 2026',
      time: '19:15',
      timeWindow: 'Night (7 PM)',
      avatar: '🐕',
      color: '#ea580c'
    },
    {
      id: 'inc-1789014867610',
      name: 'Bella',
      species: 'Dog',
      breed: 'Shih Tzu',
      speciesTag: 'Dog · Shih Tzu',
      status: 'lost',
      district: 'District 1',
      barangay: 'San Francisco del Monte',
      city: 'Quezon City',
      location: 'Roosevelt Ave. cor. Del Monte, SFDM, QC',
      contact: 'Roberto Dizon',
      phone: '+63 917 333 4455',
      lat: 14.6480,
      lng: 121.0180,
      date: 'Aug 26, 2026',
      time: '08:30',
      timeWindow: 'Morning (8 AM)',
      avatar: '🐕',
      color: '#ea580c'
    },
    {
      id: 'inc-1789014867611',
      name: 'Milo',
      species: 'Dog',
      breed: 'Golden Retriever',
      speciesTag: 'Dog · Golden Retriever',
      status: 'lost',
      district: 'District 1',
      barangay: 'Project 6',
      city: 'Quezon City',
      location: 'Road 1 cor. Alley 2, Project 6, QC',
      contact: 'Theresa Alcantara',
      phone: '+63 918 555 9012',
      lat: 14.6590,
      lng: 121.0360,
      date: 'Aug 25, 2026',
      time: '16:00',
      timeWindow: 'Afternoon (4 PM)',
      avatar: '🐕',
      color: '#ea580c'
    },
    {
      id: 'inc-1789014867612',
      name: 'Bibo',
      species: 'Dog',
      breed: 'Poodle',
      speciesTag: 'Dog · Poodle',
      status: 'found',
      district: 'District 1',
      barangay: 'Santo Domingo',
      city: 'Quezon City',
      location: 'Biak na Bato St., Sto. Domingo, QC',
      contact: 'Community Post Desk',
      phone: '+63 919 123 7890',
      lat: 14.6290,
      lng: 121.0080,
      date: 'Aug 24, 2026',
      time: '11:10',
      timeWindow: 'Morning (11 AM)',
      avatar: '🐕',
      color: '#2563eb'
    },
    {
      id: 'inc-1789014867613',
      name: 'Oliver',
      species: 'Cat',
      breed: 'Tabby',
      speciesTag: 'Cat · Tabby',
      status: 'sighting',
      district: 'District 3',
      barangay: 'Loyola Heights',
      city: 'Quezon City',
      location: 'Katipunan Ave., Loyola Heights, QC',
      contact: 'Ateneo Guard Desk',
      phone: '+63 918 222 9988',
      lat: 14.6380,
      lng: 121.0750,
      date: 'Aug 23, 2026',
      time: '17:00',
      timeWindow: 'Afternoon (5 PM)',
      avatar: '🐈',
      color: '#2563eb'
    },
    {
      id: 'inc-1789014867614',
      name: 'Casper',
      species: 'Dog',
      breed: 'Siberian Husky',
      speciesTag: 'Dog · Siberian Husky',
      status: 'lost',
      district: 'District 3',
      barangay: 'Bagumbayan / Libis',
      city: 'Quezon City',
      location: 'Eastwood Citywalk, Libis, QC',
      contact: 'Arvin Mendoza',
      phone: '+63 920 888 7766',
      lat: 14.6095,
      lng: 121.0805,
      date: 'Aug 22, 2026',
      time: '19:30',
      timeWindow: 'Night (7 PM)',
      avatar: '🐕',
      color: '#ea580c'
    },
    {
      id: 'inc-1789014867615',
      name: 'Bailey',
      species: 'Dog',
      breed: 'Beagle',
      speciesTag: 'Dog · Beagle',
      status: 'lost',
      district: 'District 3',
      barangay: 'Socorro (Cubao)',
      city: 'Quezon City',
      location: 'General Malvar Ave., Araneta City, Cubao, QC',
      contact: 'Markus Villanueva',
      phone: '+63 922 456 1234',
      lat: 14.6220,
      lng: 121.0540,
      date: 'Aug 21, 2026',
      time: '14:15',
      timeWindow: 'Afternoon (2 PM)',
      avatar: '🐕',
      color: '#ea580c'
    },
    {
      id: 'inc-1789014867616',
      name: 'Hershey',
      species: 'Dog',
      breed: 'Chocolate Labrador',
      speciesTag: 'Dog · Labrador',
      status: 'lost',
      district: 'District 4',
      barangay: 'UP Campus',
      city: 'Quezon City',
      location: 'Academic Oval, UP Diliman, QC',
      contact: 'Patricia Soriano',
      phone: '+63 917 654 3210',
      lat: 14.6540,
      lng: 121.0680,
      date: 'Aug 20, 2026',
      time: '07:45',
      timeWindow: 'Morning (7 AM)',
      avatar: '🐕',
      color: '#ea580c'
    },
    {
      id: 'inc-1789014867617',
      name: 'Simba',
      species: 'Cat',
      breed: 'Calico Cat',
      speciesTag: 'Cat · Calico',
      status: 'sighting',
      district: 'District 4',
      barangay: 'South Triangle',
      city: 'Quezon City',
      location: 'Tomas Morato Ave. cor. Scout Lozano, QC',
      contact: 'Scout Area Patrol',
      phone: '+63 928 999 0011',
      lat: 14.6360,
      lng: 121.0340,
      date: 'Aug 19, 2026',
      time: '21:00',
      timeWindow: 'Night (9 PM)',
      avatar: '🐈',
      color: '#2563eb'
    },
    {
      id: 'inc-1789014867618',
      name: 'Charlie',
      species: 'Dog',
      breed: 'Shih Tzu',
      speciesTag: 'Dog · Shih Tzu',
      status: 'lost',
      district: 'District 5',
      barangay: 'Greater Lagro',
      city: 'Quezon City',
      location: 'Ascension Ave., Greater Lagro, Novaliches, QC',
      contact: 'Maricel Bautista',
      phone: '+63 917 222 8899',
      lat: 14.7210,
      lng: 121.0620,
      date: 'Aug 18, 2026',
      time: '18:30',
      timeWindow: 'Evening (6 PM)',
      avatar: '🐕',
      color: '#ea580c'
    },
    {
      id: 'inc-1789014867619',
      name: 'Mocha',
      species: 'Cat',
      breed: 'Domestic Shorthair',
      speciesTag: 'Cat · Domestic',
      status: 'found',
      district: 'District 5',
      barangay: 'Fairview',
      city: 'Quezon City',
      location: 'Fairview Terraces / Quirino Highway, QC',
      contact: 'Fairview Mall Security',
      phone: '+63 920 333 4455',
      lat: 14.7335,
      lng: 121.0583,
      date: 'Aug 17, 2026',
      time: '13:00',
      timeWindow: 'Afternoon (1 PM)',
      avatar: '🐈',
      color: '#2563eb'
    },
    {
      id: 'inc-1789014867620',
      name: 'Chico',
      species: 'Dog',
      breed: 'Corgi',
      speciesTag: 'Dog · Corgi',
      status: 'lost',
      district: 'District 6',
      barangay: 'Tandang Sora',
      city: 'Quezon City',
      location: 'Banlat Road, Tandang Sora, QC',
      contact: 'Karen Manalo',
      phone: '+63 920 555 1122',
      lat: 14.6750,
      lng: 121.0510,
      date: 'Aug 16, 2026',
      time: '19:40',
      timeWindow: 'Night (7 PM)',
      avatar: '🐕',
      color: '#ea580c'
    },
    {
      id: 'inc-1789014867621',
      name: 'Oreo',
      species: 'Cat',
      breed: 'Domestic Tuxedo',
      speciesTag: 'Cat · Tuxedo',
      status: 'sighting',
      district: 'District 6',
      barangay: 'Sauyo',
      city: 'Quezon City',
      location: 'Sauyo Road near Old Sauyo Market, QC',
      contact: 'Sauyo Community Desk',
      phone: '+63 919 777 6655',
      lat: 14.6950,
      lng: 121.0420,
      date: 'Aug 15, 2026',
      time: '09:15',
      timeWindow: 'Morning (9 AM)',
      avatar: '🐈',
      color: '#2563eb'
    },
    {
      id: 'inc-1789014867622',
      name: 'Toby',
      species: 'Dog',
      breed: 'Aspin / Mixed',
      speciesTag: 'Dog · Aspin',
      status: 'lost',
      district: 'District 6',
      barangay: 'Talipapa',
      city: 'Quezon City',
      location: 'Quirino Highway, Talipapa, QC',
      contact: 'Danilo Pineda',
      phone: '+63 922 111 4433',
      lat: 14.6850,
      lng: 121.0340,
      date: 'Aug 14, 2026',
      time: '15:45',
      timeWindow: 'Afternoon (3 PM)',
      avatar: '🐕',
      color: '#ea580c'
    }
  ],

  getFilteredIncidents() {
    let list = [...this.incidentsData];

    // Animal Filter
    if (this.selectedAnimal === 'dog') {
      list = list.filter(i => (i.species || '').toLowerCase() === 'dog');
    } else if (this.selectedAnimal === 'cat') {
      list = list.filter(i => (i.species || '').toLowerCase() === 'cat');
    } else if (this.selectedAnimal === 'other') {
      list = list.filter(i => !['dog', 'cat'].includes((i.species || '').toLowerCase()));
    }

    // Status Filter
    if (this.selectedStatus && this.selectedStatus !== 'all') {
      list = list.filter(i => (i.status || '').toLowerCase() === this.selectedStatus.toLowerCase());
    }

    // District Filter
    if (this.selectedDistrict && this.selectedDistrict !== 'all' && this.selectedDistrict !== 'All Districts') {
      list = list.filter(i => i.district === this.selectedDistrict);
    }

    // Search query
    if (this.searchQuery && this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      list = list.filter(i =>
        (i.name && i.name.toLowerCase().includes(q)) ||
        (i.location && i.location.toLowerCase().includes(q)) ||
        (i.barangay && i.barangay.toLowerCase().includes(q)) ||
        (i.species && i.species.toLowerCase().includes(q)) ||
        (i.id && i.id.toLowerCase().includes(q)) ||
        (i.contact && i.contact.toLowerCase().includes(q))
      );
    }

    // Sorting
    if (this.sortBy === 'name') {
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else if (this.sortBy === 'location') {
      list.sort((a, b) => (a.barangay || a.location || '').localeCompare(b.barangay || b.location || ''));
    } else if (this.sortBy === 'status') {
      list.sort((a, b) => (a.status || '').localeCompare(b.status || ''));
    } else {
      // Default date
      list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    return list;
  },

  getHotspots() {
    return [
      { rank: 1, barangay: 'Batasan Hills', city: 'Quezon City (District 2)', dogs: 4, cats: 0, riskLevel: 'HIGH RISK', riskClass: 'risk-high', totalReports: 4, lat: 14.6865, lng: 121.0874 },
      { rank: 2, barangay: 'Commonwealth', city: 'Quezon City (District 2)', dogs: 2, cats: 1, riskLevel: 'HIGH RISK', riskClass: 'risk-high', totalReports: 3, lat: 14.7046, lng: 121.0792 },
      { rank: 3, barangay: 'Payatas', city: 'Quezon City (District 2)', dogs: 1, cats: 1, riskLevel: 'HIGH RISK', riskClass: 'risk-high', totalReports: 2, lat: 14.7118, lng: 121.1037 },
      { rank: 4, barangay: 'Diliman / Teachers Village', city: 'Quezon City (District 4)', dogs: 1, cats: 1, riskLevel: 'MODERATE RISK', riskClass: 'risk-moderate', totalReports: 2, lat: 14.6420, lng: 121.0580 },
      { rank: 5, barangay: 'Bagbag Novaliches', city: 'Quezon City (District 5)', dogs: 1, cats: 0, riskLevel: 'MODERATE RISK', riskClass: 'risk-moderate', totalReports: 1, lat: 14.7005, lng: 121.0380 },
      { rank: 6, barangay: 'San Francisco del Monte (SFDM)', city: 'Quezon City (District 1)', dogs: 1, cats: 0, riskLevel: 'MODERATE RISK', riskClass: 'risk-moderate', totalReports: 1, lat: 14.6480, lng: 121.0180 },
      { rank: 7, barangay: 'Loyola Heights / Katipunan', city: 'Quezon City (District 3)', dogs: 0, cats: 1, riskLevel: 'MODERATE RISK', riskClass: 'risk-moderate', totalReports: 1, lat: 14.6380, lng: 121.0750 },
      { rank: 8, barangay: 'Tandang Sora', city: 'Quezon City (District 6)', dogs: 1, cats: 0, riskLevel: 'MODERATE RISK', riskClass: 'risk-moderate', totalReports: 1, lat: 14.6750, lng: 121.0510 },
      { rank: 9, barangay: 'Holy Spirit', city: 'Quezon City (District 2)', dogs: 0, cats: 1, riskLevel: 'MODERATE RISK', riskClass: 'risk-moderate', totalReports: 1, lat: 14.6865, lng: 121.0682 },
      { rank: 10, barangay: 'Bagong Silangan', city: 'Quezon City (District 2)', dogs: 1, cats: 0, riskLevel: 'MODERATE RISK', riskClass: 'risk-moderate', totalReports: 1, lat: 14.7081, lng: 121.1152 }
    ];
  },

  render(container) {
    const filteredIncidents = this.getFilteredIncidents();
    const totalCount = filteredIncidents.length;
    const lostCount = filteredIncidents.filter(i => i.status === 'lost').length;
    const dogCount = filteredIncidents.filter(i => i.species.toLowerCase() === 'dog').length;
    const catCount = filteredIncidents.filter(i => i.species.toLowerCase() === 'cat').length;
    const hotspots = this.getHotspots();
    const activeDistrictsSet = new Set(filteredIncidents.map(i => i.district));
    const activeDistrictsCount = activeDistrictsSet.size;
    const dogPct = totalCount > 0 ? ((dogCount / totalCount) * 100).toFixed(1) : '0.0';
    const topSpot = hotspots[0] || { barangay: 'Batasan Hills', totalReports: 3 };

    // Pagination calculations
    const totalPages = Math.ceil(totalCount / this.pageSize) || 1;
    if (this.currentPage > totalPages) this.currentPage = totalPages;
    if (this.currentPage < 1) this.currentPage = 1;

    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = Math.min(startIndex + this.pageSize, totalCount);
    const paginatedIncidents = filteredIncidents.slice(startIndex, endIndex);

    container.innerHTML = `
      <div class="heatmap-dashboard-view">
        <!-- 1. Header Row: Title, Subtitle, Reset Filters & Log Pin -->
        <div class="heatmap-header-row">
          <div class="header-titles">
            <h1 class="view-title">Heatmap</h1>
            <p class="view-sub">Where lost and stray animals are being reported across Quezon City</p>
          </div>
          <div class="header-actions">
            <button class="btn btn-secondary btn-sm" id="btn-reset-heatmap-filters">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
              Reset Filters
            </button>
            <button class="btn btn-primary btn-sm" id="btn-log-lost-pin">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Log Lost Pet Pin
            </button>
          </div>
        </div>

        <!-- 2. Top KPI Cards Row -->
        <div class="heatmap-kpi-row">
          <!-- Card 1: Active Lost Pets -->
          <div class="nock-card kpi-card">
            <div class="kpi-card-top">
              <span class="kpi-label">Active Lost Pets</span>
            </div>
            <div class="kpi-main-val">
              <span class="kpi-number">${lostCount}</span>
              <span class="kpi-unit">Lost Pets</span>
            </div>
            <div class="kpi-footer-sub">in active roam / in registry</div>
          </div>

          <!-- Card 2: Lost Dogs -->
          <div class="nock-card kpi-card">
            <div class="kpi-card-top">
              <span class="kpi-label">Lost Dogs (Aso)</span>
            </div>
            <div class="kpi-main-val">
              <span class="kpi-number">${dogCount}</span>
              <span class="kpi-unit">Dogs</span>
            </div>
            <div class="kpi-footer-sub">Canine lost / stray alerts</div>
          </div>

          <!-- Card 3: Lost Cats -->
          <div class="nock-card kpi-card">
            <div class="kpi-card-top">
              <span class="kpi-label">Lost Cats (Pusa)</span>
            </div>
            <div class="kpi-main-val">
              <span class="kpi-number">${catCount}</span>
              <span class="kpi-unit">Cats</span>
            </div>
            <div class="kpi-footer-sub">Feline lost / stray alerts</div>
          </div>

          <!-- Card 4: Primary Hotspot -->
          <div class="nock-card kpi-card">
            <div class="kpi-card-top">
              <span class="kpi-label">Primary Hotspot</span>
            </div>
            <div class="kpi-main-val">
              <span class="kpi-title-text" title="${topSpot.barangay}">${topSpot.barangay}</span>
            </div>
            <div class="kpi-footer-sub">${topSpot.totalReports} reports (${topSpot.city ? topSpot.city.replace('Quezon City ', '') : 'QC'})</div>
          </div>
        </div>

        <!-- 3. Dual-Row Filter Controls Toolbar -->
        <div class="nock-card heatmap-filter-card">
          <!-- Filter Row 1: Date Range & Layer -->
          <div class="filter-row-upper">
            <div class="filter-left-group">
              <span class="filter-tag">DATE:</span>
              <div class="filter-pills-list">
                <button class="range-pill ${this.selectedDateRange === 'all' ? 'active' : ''}" data-range="all">All-Time</button>
                <button class="range-pill ${this.selectedDateRange === 'today' ? 'active' : ''}" data-range="today">Today</button>
                <button class="range-pill ${this.selectedDateRange === '7d' ? 'active' : ''}" data-range="7d">Last 7 Days</button>
                <button class="range-pill ${this.selectedDateRange === '30d' ? 'active' : ''}" data-range="30d">Last 30 Days</button>
                <button class="range-pill ${this.selectedDateRange === 'custom' ? 'active' : ''}" data-range="custom">Custom Range</button>
              </div>
            </div>

            <div class="filter-right-group">
              <span class="filter-tag">LAYER:</span>
              <select id="select-map-layer" class="filter-select-sm">
                <option value="roadmap" ${this.selectedLayer === 'roadmap' ? 'selected' : ''}>Google Roadmap</option>
                <option value="satellite" ${this.selectedLayer === 'satellite' ? 'selected' : ''}>Google Satellite</option>
                <option value="terrain" ${this.selectedLayer === 'terrain' ? 'selected' : ''}>Google Terrain</option>
                <option value="osm" ${this.selectedLayer === 'osm' ? 'selected' : ''}>OpenStreetMap</option>
              </select>
            </div>
          </div>

          <!-- Filter Row 2: Animal, Status, District & Search -->
          <div class="filter-row-lower">
            <div class="filter-left-group">
              <span class="filter-tag">ANIMAL:</span>
              <div class="filter-pills-list">
                <button class="animal-pill ${this.selectedAnimal === 'all' ? 'active' : ''}" data-animal="all">All (${totalCount})</button>
                <button class="animal-pill ${this.selectedAnimal === 'dog' ? 'active' : ''}" data-animal="dog">Dogs (${dogCount})</button>
                <button class="animal-pill ${this.selectedAnimal === 'cat' ? 'active' : ''}" data-animal="cat">Cats (${catCount})</button>
                <button class="animal-pill ${this.selectedAnimal === 'other' ? 'active' : ''}" data-animal="other">Others</button>
              </div>
            </div>

            <div class="filter-right-group">
              <div class="filter-select-item">
                <span class="filter-tag">STATUS:</span>
                <select id="select-status-filter" class="filter-select-sm">
                  <option value="all" ${this.selectedStatus === 'all' ? 'selected' : ''}>All Statuses</option>
                  <option value="lost" ${this.selectedStatus === 'lost' ? 'selected' : ''}>Lost</option>
                  <option value="sighting" ${this.selectedStatus === 'sighting' ? 'selected' : ''}>Sighted</option>
                  <option value="found" ${this.selectedStatus === 'found' ? 'selected' : ''}>Found</option>
                </select>
              </div>

              <div class="filter-select-item">
                <span class="filter-tag">DISTRICT:</span>
                <select id="select-district-filter" class="filter-select-sm" title="Select Quezon City District to auto-redirect map">
                  <option value="all" ${this.selectedDistrict === 'all' ? 'selected' : ''}>All Districts</option>
                  <option value="District 1" ${this.selectedDistrict === 'District 1' ? 'selected' : ''}>District 1</option>
                  <option value="District 2" ${this.selectedDistrict === 'District 2' ? 'selected' : ''}>District 2</option>
                  <option value="District 3" ${this.selectedDistrict === 'District 3' ? 'selected' : ''}>District 3</option>
                  <option value="District 4" ${this.selectedDistrict === 'District 4' ? 'selected' : ''}>District 4</option>
                  <option value="District 5" ${this.selectedDistrict === 'District 5' ? 'selected' : ''}>District 5</option>
                  <option value="District 6" ${this.selectedDistrict === 'District 6' ? 'selected' : ''}>District 6</option>
                </select>
              </div>


              <div class="filter-search-box">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                <input type="text" id="heatmap-search-input" placeholder="Search place (e.g. Ever Gotesco), pet..." value="${this.searchQuery}" autocomplete="off" />
                <div id="heatmap-search-suggestions" class="search-suggestions-dropdown hidden"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- 4. Map & Top Lost Pet Hotspots Side-by-Side Row -->
        <div class="heatmap-map-hotspots-row">
          <!-- Left: Minimized / Compact Interactive Map Viewport -->
          <div class="heatmap-map-card" id="heatmap-map-card">
            <div id="pawtrack-leaflet-map" class="pawtrack-map-viewport"></div>

            <!-- Top-Right Floating Fullscreen Button -->
            <button class="map-fullscreen-btn" id="btn-map-fullscreen" title="Toggle Fullscreen Map">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
              <span id="fullscreen-btn-text">Fullscreen</span>
            </button>

            <!-- Bottom-Right Floating Heatmap Intensity Legend -->
            <div class="map-floating-legend">
              <div class="legend-header">
                <span class="legend-title">HEATMAP INTENSITY</span>
                <span class="legend-subtitle">DENSITY</span>
              </div>
              <div class="legend-bar"></div>
              <div class="legend-labels">
                <div class="legend-label-item"><span class="legend-dot dot-low"></span> Low</div>
                <div class="legend-label-item"><span class="legend-dot dot-moderate"></span> Moderate</div>
                <div class="legend-label-item"><span class="legend-dot dot-high"></span> High</div>
                <div class="legend-label-item"><span class="legend-dot dot-very-high"></span> Very High</div>
              </div>
            </div>
          </div>

          <!-- Right: Top Lost Pet Hotspots (Side by Side with Map) -->
          <div class="nock-card heatmap-hotspots-card">
            <div class="heatmap-card-header">
              <div class="heatmap-card-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" class="title-icon"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                <span>Top Lost Pet Hotspots</span>
              </div>
              <span class="header-caption">Ranked by Incident Frequency (Top 10 Sectors)</span>
            </div>

            <div class="hotspots-list">
              ${hotspots.map(spot => `
                <div class="hotspot-row" data-lat="${spot.lat}" data-lng="${spot.lng}" data-name="${spot.barangay}" title="Click to center map on ${spot.barangay}">
                  <div class="hotspot-rank">#${spot.rank}</div>
                  <div class="hotspot-info">
                    <div class="hotspot-name">${spot.barangay}</div>
                    <div class="hotspot-sub">${spot.city} · ${spot.dogs} dogs, ${spot.cats} cats</div>
                  </div>
                  <div class="hotspot-stats">
                    <span class="risk-badge ${spot.riskClass}">${spot.riskLevel}</span>
                    <span class="hotspot-count-label">${spot.totalReports} reports</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- 5. Lost Pet Reports Over Time -->
        <div class="nock-card heatmap-trends-card">
          <div class="heatmap-card-header">
            <div class="heatmap-card-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" class="title-icon"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
              <span>Lost Pet Reports Over Time</span>
            </div>
            <div class="timeframe-switchers">
              <button class="timeframe-btn ${this.currentTimeframe === 'daily' ? 'active' : ''}" data-tf="daily">Daily</button>
              <button class="timeframe-btn ${this.currentTimeframe === 'weekly' ? 'active' : ''}" data-tf="weekly">Weekly</button>
              <button class="timeframe-btn ${this.currentTimeframe === 'monthly' ? 'active' : ''}" data-tf="monthly">Monthly</button>
            </div>
          </div>

          <!-- Trend Insight Callout Banner -->
          <div class="trend-insight-banner">
            <div class="trend-insight-left">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" class="insight-icon"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span><strong>Trend Insight:</strong> Reports increased by 100% over the last 48 hours compared to previous weekend.</span>
            </div>
            <span class="trend-insight-badge">+100% VS PREV PERIOD</span>
          </div>

          <!-- Activity Chart with Daily Histogram Bars -->
          <div class="trend-chart-container">
            <div class="trend-bars-layout">
              <div class="trend-bar-col">
                <span class="bar-val">0</span>
                <div class="bar-track"><div class="bar-fill" style="height: 4%;"></div></div>
                <span class="bar-date">Sep 1</span>
              </div>
              <div class="trend-bar-col">
                <span class="bar-val">0</span>
                <div class="bar-track"><div class="bar-fill" style="height: 4%;"></div></div>
                <span class="bar-date">Sep 2</span>
              </div>
              <div class="trend-bar-col">
                <span class="bar-val">1</span>
                <div class="bar-track"><div class="bar-fill" style="height: 20%;"></div></div>
                <span class="bar-date">Sep 3</span>
              </div>
              <div class="trend-bar-col">
                <span class="bar-val">1</span>
                <div class="bar-track"><div class="bar-fill" style="height: 20%;"></div></div>
                <span class="bar-date">Sep 4</span>
              </div>
              <div class="trend-bar-col">
                <span class="bar-val">2</span>
                <div class="bar-track"><div class="bar-fill" style="height: 40%;"></div></div>
                <span class="bar-date">Sep 5</span>
              </div>
              <div class="trend-bar-col peak">
                <span class="bar-val peak-val">5</span>
                <div class="bar-track"><div class="bar-fill peak-fill" style="height: 100%;"></div></div>
                <span class="bar-date peak-date">Sep 6</span>
              </div>
              <div class="trend-bar-col">
                <span class="bar-val">2</span>
                <div class="bar-track"><div class="bar-fill" style="height: 40%;"></div></div>
                <span class="bar-date">Sep 7</span>
              </div>
            </div>
          </div>
        </div>


        <!-- 6. Location & Sector Analysis Row (Metric Strip) -->
        <div class="location-sector-strip-card nock-card">
          <div class="sector-strip-header">
            <div class="sector-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" class="title-icon"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/></svg>
              <span>Location & Sector Analysis</span>
            </div>
            <span class="sector-subtitle">Aggregated Geospatial Telemetry · Quezon City</span>
          </div>

          <div class="sector-metrics-row">
            <!-- Cell 1: Total Plotted Incidents -->
            <div class="sector-metric-cell">
              <div class="cell-top-header">
                <span class="cell-label">TOTAL PLOTTED INCIDENTS</span>
                <span class="cell-pill pill-neutral">FILTERED</span>
              </div>
              <div class="cell-val-group">
                <span class="cell-val">${totalCount}</span>
                <span class="cell-val-unit">Reports</span>
              </div>
              <span class="cell-desc">Active in current view</span>
            </div>

            <!-- Cell 2: High Density Hotspot -->
            <div class="sector-metric-cell">
              <div class="cell-top-header">
                <span class="cell-label">HIGH DENSITY HOTSPOT</span>
                <span class="cell-pill pill-terracotta">HIGH RISK</span>
              </div>
              <div class="cell-val-group">
                <span class="cell-val text-terracotta" title="${topSpot.barangay}">${topSpot.barangay}</span>
              </div>
              <span class="cell-desc">${topSpot.totalReports} logged reports</span>
            </div>

            <!-- Cell 3: Primary Species Sector -->
            <div class="sector-metric-cell">
              <div class="cell-top-header">
                <span class="cell-label">PRIMARY SPECIES SECTOR</span>
                <span class="cell-pill pill-blue">CANINE</span>
              </div>
              <div class="cell-val-group">
                <span class="cell-val">Dogs (${dogPct}%)</span>
              </div>
              <span class="cell-desc">${dogCount} of ${totalCount} alerts</span>
            </div>

            <!-- Cell 4: Peak Report Time Window -->
            <div class="sector-metric-cell">
              <div class="cell-top-header">
                <span class="cell-label">PEAK REPORT TIME WINDOW</span>
                <span class="cell-pill pill-amber">EVENING</span>
              </div>
              <div class="cell-val-group">
                <span class="cell-val">4:00 PM – 9:00 PM</span>
              </div>
              <span class="cell-desc">Highest roaming frequency</span>
            </div>

            <!-- Cell 5: Active Cluster Radius -->
            <div class="sector-metric-cell">
              <div class="cell-top-header">
                <span class="cell-label">ACTIVE CLUSTER RADIUS</span>
                <span class="cell-pill pill-emerald">QC GRID</span>
              </div>
              <div class="cell-val-group">
                <span class="cell-val">${activeDistrictsCount} ${activeDistrictsCount === 1 ? 'District' : 'Districts'}</span>
              </div>
              <span class="cell-desc">Quezon City municipal zones</span>
            </div>
          </div>
        </div>

        <!-- 7. Bottom Table: Lost Animal & Incident Locations -->
        <div class="nock-card heatmap-table-card">
          <div class="table-header-row">
            <div class="table-title-group">
              <div class="table-title-with-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" class="table-icon"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                <span class="table-main-title">Lost Animal & Incident Locations</span>
              </div>
              <span class="table-count-badge">${totalCount} Total Records</span>
              ${this.selectedDistrict !== 'all' ? `<span class="table-district-pill">📍 ${this.selectedDistrict}</span>` : ''}
            </div>
            <div class="table-sort-group">
              <span class="sort-label">Sort by:</span>
              <button class="sort-btn ${this.sortBy === 'date' ? 'active' : ''}" data-sort="date">Date ▾</button>
              <button class="sort-btn ${this.sortBy === 'name' ? 'active' : ''}" data-sort="name">Name</button>
              <button class="sort-btn ${this.sortBy === 'location' ? 'active' : ''}" data-sort="location">Location</button>
              <button class="sort-btn ${this.sortBy === 'status' ? 'active' : ''}" data-sort="status">Status</button>
            </div>
          </div>

          <div class="data-table-wrapper">
            <table class="nock-data-table">
              <thead>
                <tr>
                  <th style="width: 22%;">ANIMAL / SPECIES</th>
                  <th style="width: 10%;">STATUS</th>
                  <th style="width: 24%;">LOCATION / BARANGAY</th>
                  <th style="width: 14%;">COORDINATES</th>
                  <th style="width: 13%;">REPORTED DATE</th>
                  <th style="width: 17%;">CONTACT / REPORTER</th>
                  <th style="text-align: right; width: 10%;">ACTION</th>
                </tr>
              </thead>
              <tbody>
                ${paginatedIncidents.length === 0 ? `
                  <tr>
                    <td colspan="7" class="table-empty-row">
                      <div class="table-empty-state">
                        <span class="empty-icon">🔍</span>
                        <div class="empty-title">No incidents match the active filters</div>
                        <div class="empty-desc">Try changing district, animal species, or date filters to view records.</div>
                      </div>
                    </td>
                  </tr>
                ` : paginatedIncidents.map(inc => `
                  <tr class="incident-table-row" data-lat="${inc.lat}" data-lng="${inc.lng}" data-id="${inc.id}">
                    <td>
                      <div class="animal-cell">
                        <span class="animal-avatar-box">${inc.avatar || '🐾'}</span>
                        <div class="animal-info">
                          <span class="animal-name">${inc.name}</span>
                          <span class="animal-breed">${inc.speciesTag}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span class="status-pill ${inc.status === 'lost' ? 'status-lost' : (inc.status === 'found' ? 'status-safe' : 'status-pending')}">
                        ${inc.status.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <div class="location-cell">
                        <div class="loc-main-group">
                          <span class="loc-main">${inc.barangay}</span>
                          <span class="loc-district-tag">${inc.district || 'QC'}</span>
                        </div>
                        <span class="loc-sub">${inc.location}</span>
                      </div>
                    </td>
                    <td>
                      <span class="mono-tag mono-tag-coords">${inc.lat.toFixed(4)}, ${inc.lng.toFixed(4)}</span>
                    </td>
                    <td>
                      <div class="date-time-cell">
                        <span class="date-main">${inc.date}</span>
                        <span class="time-sub">${inc.time || inc.timeWindow || ''}</span>
                      </div>
                    </td>
                    <td>
                      <div class="contact-cell">
                        <span class="contact-name">${inc.contact}</span>
                        <span class="contact-phone">${inc.phone}</span>
                      </div>
                    </td>
                    <td style="text-align: right;">
                      <button class="btn btn-xs btn-secondary btn-fly-to btn-fly-to-map" data-lat="${inc.lat}" data-lng="${inc.lng}" data-id="${inc.id}" title="Fly to map coordinates">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        Fly to Location
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <!-- Table Pagination Footer -->
          <div class="table-pagination-footer">
            <div class="pagination-info">
              Showing <strong>${totalCount === 0 ? 0 : startIndex + 1}</strong>–<strong>${endIndex}</strong> of <strong>${totalCount}</strong> incidents (Quezon City)
            </div>
            ${totalPages > 1 ? `
              <div class="pagination-controls">
                <button class="page-btn page-nav-btn ${this.currentPage === 1 ? 'disabled' : ''}" data-page="${this.currentPage - 1}" ${this.currentPage === 1 ? 'disabled' : ''}>
                  ‹ Prev
                </button>
                <div class="page-numbers">
                  ${Array.from({ length: totalPages }, (_, i) => i + 1).map(p => `
                    <button class="page-btn page-num-btn ${this.currentPage === p ? 'active' : ''}" data-page="${p}">
                      ${p}
                    </button>
                  `).join('')}
                </div>
                <button class="page-btn page-nav-btn ${this.currentPage === totalPages ? 'disabled' : ''}" data-page="${this.currentPage + 1}" ${this.currentPage === totalPages ? 'disabled' : ''}>
                  Next ›
                </button>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;

    // Initialize Map & Event Listeners (Browser only)
    if (typeof document !== 'undefined') {
      this.initLeafletMap(filteredIncidents);
      this.initEventListeners(hotspots);
    }
  },

  initLeafletMap(incidents) {
    const mapElement = document.getElementById('pawtrack-leaflet-map');
    if (!mapElement) return;

    const currentDistrict = (this.qcDistricts && this.qcDistricts[this.selectedDistrict]) ? this.qcDistricts[this.selectedDistrict] : this.qcDistricts['all'];
    const defaultCenter = currentDistrict ? currentDistrict.center : [14.6760, 121.0550];
    const defaultZoom = currentDistrict ? currentDistrict.zoom : 12.8;

    if (this.mapInstance) {
      try { this.mapInstance.remove(); } catch (e) {}
      this.mapInstance = null;
    }

    if (typeof L === 'undefined') return;

    this.mapInstance = L.map(mapElement, {
      center: defaultCenter,
      zoom: defaultZoom,
      zoomControl: true,
      attributionControl: false
    });


    // Layer URL mapping
    let tileUrl = 'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
    let subdomains = ['mt0', 'mt1', 'mt2', 'mt3'];

    if (this.selectedLayer === 'satellite') {
      tileUrl = 'https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}';
    } else if (this.selectedLayer === 'terrain') {
      tileUrl = 'https://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}';
    } else if (this.selectedLayer === 'osm') {
      tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      subdomains = ['a', 'b', 'c'];
    }

    this.tileLayerInstance = L.tileLayer(tileUrl, {
      maxZoom: 20,
      subdomains: subdomains
    }).addTo(this.mapInstance);

    // Heatmap density cluster points
    const heatPoints = incidents.map(inc => [inc.lat, inc.lng, inc.status === 'lost' ? 0.95 : 0.7]);
    heatPoints.push([14.6865, 121.0874, 1.0]);
    heatPoints.push([14.6934, 121.0954, 0.9]);
    heatPoints.push([14.7046, 121.0792, 0.85]);

    if (typeof L.heatLayer === 'function') {
      this.heatLayer = L.heatLayer(heatPoints, {
        radius: 46,
        blur: 30,
        maxZoom: 16,
        max: 1.0,
        gradient: {
          0.15: '#22c55e',
          0.45: '#eab308',
          0.72: '#f97316',
          1.00: '#ef4444'
        }
      }).addTo(this.mapInstance);
    }

    // Add Markers Layer
    this.markersLayer = L.layerGroup().addTo(this.mapInstance);

    incidents.forEach(inc => {
      const isBlue = inc.color === '#2563eb' || inc.status === 'found';
      const markerColor = isBlue ? '#2563eb' : '#ea580c';
      const ringColor = isBlue ? 'rgba(37, 99, 235, 0.35)' : 'rgba(234, 88, 12, 0.35)';

      const customIcon = L.divIcon({
        className: 'pawtrack-map-marker',
        html: `
          <div class="marker-pulse-wrapper" style="--ring-color: ${ringColor}; --dot-color: ${markerColor};">
            <div class="marker-pulse-ring"></div>
            <div class="marker-center-dot" style="background: ${markerColor}; border: 2.5px solid #ffffff; box-shadow: 0 2px 5px rgba(0,0,0,0.45);"></div>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        popupAnchor: [0, -14]
      });

      const popupHtml = `
        <div class="pawtrack-infowindow-card">
          <div class="infowindow-header">
            <div>
              <div class="infowindow-id">${inc.name} (${inc.id})</div>
              <div class="infowindow-species">${inc.speciesTag}</div>
            </div>
            <button class="infowindow-close-btn" onclick="window.HeatmapView.mapInstance.closePopup()">✕</button>
          </div>

          <div class="infowindow-status-banner">
            <span class="status-label">Status:</span>
            <strong class="status-val-lost">${inc.status.toUpperCase()}</strong>
          </div>

          <div class="infowindow-details-list">
            <div class="infowindow-row">
              <span class="row-key">Location:</span>
              <span class="row-val">${inc.location}</span>
            </div>
            <div class="infowindow-row">
              <span class="row-key">District:</span>
              <span class="row-val">${inc.district}</span>
            </div>
            <div class="infowindow-row">
              <span class="row-key">Contact:</span>
              <span class="row-val">${inc.contact} (${inc.phone})</span>
            </div>
            <div class="infowindow-row">
              <span class="row-key">Coords:</span>
              <span class="row-val mono">${inc.lat.toFixed(4)}, ${inc.lng.toFixed(4)}</span>
            </div>
          </div>

          <div class="infowindow-footer">
            <button class="btn-edit-location" onclick="window.location.hash='#pets'">
              View in Registry
            </button>
          </div>
        </div>
      `;

      const marker = L.marker([inc.lat, inc.lng], { icon: customIcon })
        .bindPopup(popupHtml, { maxWidth: 320, minWidth: 260, className: 'pawtrack-custom-infowindow-popup' });

      this.markersLayer.addLayer(marker);
    });

    // Map click to inspect coordinates and pin directly
    this.mapInstance.on('click', (e) => {
      const clickedLat = e.latlng.lat;
      const clickedLng = e.latlng.lng;
      if (typeof L !== 'undefined') {
        L.popup({ className: 'pawtrack-custom-infowindow-popup' })
          .setLatLng(e.latlng)
          .setContent(`
            <div style="padding: 8px 10px; font-family: var(--font-sans); min-width: 200px;">
              <div style="font-size: 10px; font-weight: 800; font-family: var(--font-mono); color: #ea580c; text-transform: uppercase;">📍 Map Coordinates</div>
              <div style="font-size: 12px; font-weight: 700; color: #111827; margin: 4px 0 8px 0; font-family: var(--font-mono);">${clickedLat.toFixed(5)}, ${clickedLng.toFixed(5)}</div>
              <button class="btn btn-xs btn-primary" style="width: 100%; justify-content: center; padding: 6px 10px; font-size: 11px; cursor: pointer;" onclick="window.HeatmapView.openLogPinModal(${clickedLat}, ${clickedLng})">
                + Pin Lost Pet Here
              </button>
            </div>
          `)
          .openOn(this.mapInstance);
      }
    });

    setTimeout(() => {
      if (this.mapInstance) this.mapInstance.invalidateSize();
    }, 250);
  },

  getSearchSuggestions(rawQuery) {
    if (!rawQuery || rawQuery.trim().length < 1) return [];
    const q = rawQuery.trim().toLowerCase();
    const suggestions = [];

    // Check landmarks
    (this.landmarksDirectory || []).forEach(l => {
      const nameMatch = l.name.toLowerCase().includes(q);
      const aliasMatch = (l.aliases || []).some(a => a.toLowerCase().includes(q));
      if (nameMatch || aliasMatch) {
        suggestions.push({
          type: 'landmark',
          title: l.name,
          subtitle: l.desc,
          lat: l.lat,
          lng: l.lng,
          icon: '📍'
        });
      }
    });

    // Check incidents
    (this.incidentsData || []).forEach(inc => {
      const nameMatch = (inc.name || '').toLowerCase().includes(q);
      const locMatch = (inc.location || '').toLowerCase().includes(q);
      const bgMatch = (inc.barangay || '').toLowerCase().includes(q);
      if (nameMatch || locMatch || bgMatch) {
        suggestions.push({
          type: 'incident',
          title: `${inc.name} (${inc.species})`,
          subtitle: `${inc.barangay} · ${inc.location}`,
          lat: inc.lat,
          lng: inc.lng,
          id: inc.id,
          icon: (inc.species || '').toLowerCase() === 'cat' ? '🐈' : '🐕'
        });
      }
    });

    return suggestions.slice(0, 6);
  },

  directToLocationOrLandmark(rawQuery) {
    if (!rawQuery || !rawQuery.trim() || !this.mapInstance) return false;
    const q = rawQuery.trim().toLowerCase();

    // 1. Search in landmarks directory
    let matchedLandmark = (this.landmarksDirectory || []).find(l => {
      const nameMatch = l.name.toLowerCase().includes(q) || q.includes(l.name.toLowerCase());
      const aliasMatch = (l.aliases || []).some(a => a.toLowerCase().includes(q) || q.includes(a.toLowerCase()));
      return nameMatch || aliasMatch;
    });

    if (matchedLandmark) {
      this.flyToLocationWithPin(matchedLandmark.lat, matchedLandmark.lng, matchedLandmark.name, matchedLandmark.desc, '📍 Landmark');
      return true;
    }

    // 2. Search in incident records database
    let matchedIncident = (this.incidentsData || []).find(inc => {
      const nameMatch = (inc.name || '').toLowerCase().includes(q);
      const locMatch = (inc.location || '').toLowerCase().includes(q);
      const bgMatch = (inc.barangay || '').toLowerCase().includes(q);
      return nameMatch || locMatch || bgMatch;
    });

    if (matchedIncident) {
      this.flyToIncident(matchedIncident.lat, matchedIncident.lng, matchedIncident.id);
      return true;
    }

    // 3. Fallback: Check if user typed coordinates like "14.68, 121.08"
    const coordParts = q.split(/[\s,]+/);
    if (coordParts.length >= 2) {
      const lat = parseFloat(coordParts[0]);
      const lng = parseFloat(coordParts[1]);
      if (!isNaN(lat) && !isNaN(lng) && lat > 10 && lat < 20 && lng > 115 && lng < 130) {
        this.flyToLocationWithPin(lat, lng, 'Target Coordinates', `${lat.toFixed(4)}, ${lng.toFixed(4)}`, '🎯 GPS');
        return true;
      }
    }

    if (window.adminApp && window.adminApp.showToast) {
      window.adminApp.showToast(`No exact landmark for "${rawQuery}". Filtered incidents shown.`, 'info', 2000);
    }
    return false;
  },

  flyToLocationWithPin(lat, lng, title, subtitle, tag = '📍') {
    if (!this.mapInstance || isNaN(lat) || isNaN(lng)) return;

    this.mapInstance.flyTo([lat, lng], 16.5, {
      duration: 1.2,
      easeLinearity: 0.25
    });

    // Remove old search marker if any
    if (this.searchLocationMarker) {
      try { this.mapInstance.removeLayer(this.searchLocationMarker); } catch (e) {}
      this.searchLocationMarker = null;
    }

    if (typeof L !== 'undefined') {
      const pinIcon = L.divIcon({
        className: 'pawtrack-search-pin-marker',
        html: `
          <div class="search-pin-pulse-wrapper">
            <div class="search-pin-pulse"></div>
            <div class="search-pin-badge">
              <span class="pin-icon">📍</span>
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -18]
      });

      const popupHtml = `
        <div style="padding: 10px 12px; font-family: var(--font-sans); min-width: 200px;">
          <div style="font-size: 10px; font-weight: 800; font-family: var(--font-mono); color: #ea580c; text-transform: uppercase; margin-bottom: 2px;">${tag}</div>
          <div style="font-size: 13.5px; font-weight: 800; color: #111827; line-height: 1.25;">${title}</div>
          <div style="font-size: 11px; color: #6b7280; margin-top: 2px;">${subtitle}</div>
          <div style="font-size: 10px; font-family: var(--font-mono); color: #9ca3af; margin-top: 4px;">Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}</div>
        </div>
      `;

      this.searchLocationMarker = L.marker([lat, lng], { icon: pinIcon })
        .addTo(this.mapInstance)
        .bindPopup(popupHtml)
        .openPopup();
    }

    document.getElementById('heatmap-map-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  },

  flyToDistrict(districtKey) {
    const districtInfo = (this.qcDistricts && this.qcDistricts[districtKey]) ? this.qcDistricts[districtKey] : this.qcDistricts['all'];
    if (!districtInfo) return;

    if (this.mapInstance && districtInfo.center) {
      this.mapInstance.flyTo(districtInfo.center, districtInfo.zoom, {
        duration: 1.2,
        easeLinearity: 0.25
      });
    }
  },

  flyToIncident(lat, lng, incidentId) {
    if (this.mapInstance && !isNaN(lat) && !isNaN(lng)) {
      this.mapInstance.flyTo([lat, lng], 16, {
        duration: 1.2,
        easeLinearity: 0.25
      });

      // Scroll map into view smoothly
      document.getElementById('heatmap-map-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  },

  openLogPinModal(defaultLat = 14.6865, defaultLng = 121.0874) {
    if (!window.adminApp) return;
    const defaultDistrict = 'District 2';
    const initialBarangays = this.qcBarangaysByDistrict[defaultDistrict] || ['Batasan Hills'];

    const modalHtml = `
      <div class="modal-header">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(234, 88, 12, 0.12); color: var(--brand-terracotta); display: grid; place-items: center; flex-shrink: 0;">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          </div>
          <div>
            <div style="font-size: 15px; font-weight: 800; color: var(--ink-primary); line-height: 1.2;">Log New Lost Pet Pin</div>
            <div style="font-size: 11px; color: var(--ink-muted); margin-top: 1px;">Plot telemetry & incident details on Quezon City live map</div>
          </div>
        </div>
        <button class="icon-btn-subtle" onclick="window.adminApp.closeModal()" title="Close">&times;</button>
      </div>

      <form id="form-log-lost-pin">
        <div class="modal-body" style="display: flex; flex-direction: column; gap: 14px; max-height: calc(85vh - 120px); overflow-y: auto;">
          
          <!-- Section 1: Pet Identification -->
          <div class="form-section-card">
            <div class="form-section-header">
              <span class="section-badge">1</span>
              <span class="section-title">Pet Identification</span>
            </div>
            <div class="form-grid">
              <div class="form-group form-full">
                <label class="form-label">Pet Name *</label>
                <input type="text" id="new-pin-name" class="form-control" placeholder="e.g. Buster" required />
              </div>
              <div class="form-group">
                <label class="form-label">Species *</label>
                <select id="new-pin-species" class="form-control">
                  <option value="Dog">Dog (Canine / Aso)</option>
                  <option value="Cat">Cat (Feline / Pusa)</option>
                  <option value="Other">Other Species</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Breed / Appearance</label>
                <input type="text" id="new-pin-breed" class="form-control" placeholder="e.g. Golden Retriever / Aspin" />
              </div>
            </div>
          </div>

          <!-- Section 2: QC Location Details -->
          <div class="form-section-card">
            <div class="form-section-header">
              <span class="section-badge">2</span>
              <span class="section-title">Quezon City Geolocation</span>
            </div>
            <div class="form-grid">
              <div class="form-group">
                <label class="form-label">District *</label>
                <select id="new-pin-district" class="form-control" required>
                  <option value="District 1">District 1</option>
                  <option value="District 2" selected>District 2</option>
                  <option value="District 3">District 3</option>
                  <option value="District 4">District 4</option>
                  <option value="District 5">District 5</option>
                  <option value="District 6">District 6</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Barangay *</label>
                <select id="new-pin-barangay" class="form-control" required>
                  ${initialBarangays.map(b => `<option value="${b}" ${b === 'Batasan Hills' ? 'selected' : ''}>${b}</option>`).join('')}
                </select>
              </div>
              <div class="form-group form-full">
                <label class="form-label">Street / Landmark / House # *</label>
                <input type="text" id="new-pin-street" class="form-control" placeholder="e.g. 123 Sampaguita St. / Near Ever Gotesco Commonwealth" required />
              </div>
              <div class="form-group">
                <label class="form-label">Latitude (GPS Lat)</label>
                <input type="number" step="0.00001" id="new-pin-lat" class="form-control mono-input" value="${typeof defaultLat === 'number' ? defaultLat.toFixed(5) : defaultLat}" required />
              </div>
              <div class="form-group">
                <label class="form-label">Longitude (GPS Lng)</label>
                <input type="number" step="0.00001" id="new-pin-lng" class="form-control mono-input" value="${typeof defaultLng === 'number' ? defaultLng.toFixed(5) : defaultLng}" required />
              </div>
            </div>
          </div>

          <!-- Section 3: Reporter Contact Details -->
          <div class="form-section-card">
            <div class="form-section-header">
              <span class="section-badge">3</span>
              <span class="section-title">Reporter Information</span>
            </div>
            <div class="form-group">
              <label class="form-label">Reporter Name & Phone Number *</label>
              <input type="text" id="new-pin-contact" class="form-control" placeholder="e.g. Juan dela Cruz (+63 917 123 4567)" required />
            </div>
          </div>

        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="window.adminApp.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            Save & Plot Pin
          </button>
        </div>
      </form>
    `;

    window.adminApp.openModalContent(modalHtml);

    // Dynamic Barangay list update on District change
    const districtSelect = document.getElementById('new-pin-district');
    const barangaySelect = document.getElementById('new-pin-barangay');
    districtSelect?.addEventListener('change', (e) => {
      const selectedD = e.target.value;
      const list = this.qcBarangaysByDistrict[selectedD] || [];
      if (barangaySelect) {
        barangaySelect.innerHTML = list.map(b => `<option value="${b}">${b}</option>`).join('');
      }
    });

    document.getElementById('form-log-lost-pin')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('new-pin-name')?.value || 'Unnamed Pet';
      const species = document.getElementById('new-pin-species')?.value || 'Dog';
      const breed = document.getElementById('new-pin-breed')?.value || 'Mixed';
      const district = document.getElementById('new-pin-district')?.value || 'District 2';
      const barangay = document.getElementById('new-pin-barangay')?.value || 'Batasan Hills';
      const street = document.getElementById('new-pin-street')?.value?.trim() || '';
      const location = street ? `${street}, ${barangay}, Quezon City` : `${barangay}, Quezon City`;
      const lat = parseFloat(document.getElementById('new-pin-lat')?.value) || 14.6865;
      const lng = parseFloat(document.getElementById('new-pin-lng')?.value) || 121.0874;
      const contact = document.getElementById('new-pin-contact')?.value || 'Admin';

      const newPin = {
        id: 'inc-' + Date.now(),
        name: name,
        species: species,
        breed: breed,
        speciesTag: `${species} · ${breed}`,
        status: 'lost',
        district: district,
        barangay: barangay,
        street: street,
        city: 'Quezon City',
        location: location,
        contact: contact,
        phone: '+63 917 000 0000',
        lat: lat,
        lng: lng,
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        time: 'Just now',
        timeWindow: 'Afternoon',
        avatar: species === 'Dog' ? '🐕' : '🐈',
        color: '#ea580c'
      };

      this.incidentsData.unshift(newPin);
      window.adminApp.closeModal();
      window.adminApp.showToast(`Logged and plotted new pin for ${name}`, 'success', 2500);
      this.render(document.getElementById('view-container'));
      this.flyToIncident(lat, lng, newPin.id);
    });
  },

  initEventListeners(hotspots) {
    // Reset Filters Button
    document.getElementById('btn-reset-heatmap-filters')?.addEventListener('click', () => {
      this.selectedDateRange = 'all';
      this.selectedLayer = 'roadmap';
      this.selectedAnimal = 'all';
      this.selectedStatus = 'all';
      this.selectedDistrict = 'all';
      this.searchQuery = '';
      this.sortBy = 'date';
      this.currentPage = 1;
      if (this.searchLocationMarker && this.mapInstance) {
        try { this.mapInstance.removeLayer(this.searchLocationMarker); } catch (e) {}
        this.searchLocationMarker = null;
      }
      this.render(document.getElementById('view-container'));
      if (window.adminApp && window.adminApp.showToast) {
        window.adminApp.showToast('All filters reset to defaults', 'info', 1600);
      }
    });

    // Log Pin Button
    document.getElementById('btn-log-lost-pin')?.addEventListener('click', () => {
      this.openLogPinModal();
    });

    // Fullscreen Map Toggle
    document.getElementById('btn-map-fullscreen')?.addEventListener('click', () => {
      const mapCard = document.getElementById('heatmap-map-card');
      const btnText = document.getElementById('fullscreen-btn-text');
      if (mapCard) {
        const isFullscreen = mapCard.classList.toggle('map-fullscreen-mode');
        if (btnText) {
          btnText.textContent = isFullscreen ? 'Exit Fullscreen' : 'Fullscreen';
        }
        setTimeout(() => {
          if (this.mapInstance) this.mapInstance.invalidateSize();
        }, 200);
        if (window.adminApp && window.adminApp.showToast) {
          window.adminApp.showToast(isFullscreen ? 'Map expanded to fullscreen' : 'Map returned to standard view', 'info', 1500);
        }
      }
    });

    // Date Range Pills
    document.querySelectorAll('.range-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedDateRange = btn.getAttribute('data-range');
        this.currentPage = 1;
        this.render(document.getElementById('view-container'));
      });
    });

    // Layer Select
    document.getElementById('select-map-layer')?.addEventListener('change', (e) => {
      this.selectedLayer = e.target.value;
      const filtered = this.getFilteredIncidents();
      this.initLeafletMap(filtered);
    });

    // Animal Pills
    document.querySelectorAll('.animal-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedAnimal = btn.getAttribute('data-animal');
        this.currentPage = 1;
        this.render(document.getElementById('view-container'));
      });
    });

    // Status Select
    document.getElementById('select-status-filter')?.addEventListener('change', (e) => {
      this.selectedStatus = e.target.value;
      this.currentPage = 1;
      this.render(document.getElementById('view-container'));
    });

    // District Select
    document.getElementById('select-district-filter')?.addEventListener('change', (e) => {
      this.selectedDistrict = e.target.value;
      this.currentPage = 1;
      this.render(document.getElementById('view-container'));
      this.flyToDistrict(this.selectedDistrict);
    });

    // Search Box & Suggestions Autocomplete & Direct Jump
    const searchInput = document.getElementById('heatmap-search-input');
    const suggestionsDropdown = document.getElementById('heatmap-search-suggestions');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const val = e.target.value;
        this.searchQuery = val;
        this.currentPage = 1;
        const filtered = this.getFilteredIncidents();
        this.initLeafletMap(filtered);

        // Render Suggestions
        if (suggestionsDropdown) {
          const suggestions = this.getSearchSuggestions(val);
          if (suggestions.length > 0 && val.trim().length >= 1) {
            suggestionsDropdown.innerHTML = suggestions.map(s => `
              <div class="suggestion-item" data-lat="${s.lat}" data-lng="${s.lng}" data-title="${s.title}" data-subtitle="${s.subtitle || ''}" data-id="${s.id || ''}" data-type="${s.type}">
                <span class="suggestion-icon">${s.icon || '📍'}</span>
                <div class="suggestion-content">
                  <span class="suggestion-title">${s.title}</span>
                  <span class="suggestion-sub">${s.subtitle || ''}</span>
                </div>
              </div>
            `).join('');
            suggestionsDropdown.classList.remove('hidden');

            // Attach click to suggestion items
            suggestionsDropdown.querySelectorAll('.suggestion-item').forEach(item => {
              item.addEventListener('click', () => {
                const lat = parseFloat(item.getAttribute('data-lat'));
                const lng = parseFloat(item.getAttribute('data-lng'));
                const title = item.getAttribute('data-title');
                const subtitle = item.getAttribute('data-subtitle');
                const id = item.getAttribute('data-id');
                const type = item.getAttribute('data-type');

                searchInput.value = title;
                this.searchQuery = title;
                this.currentPage = 1;
                suggestionsDropdown.classList.add('hidden');

                if (type === 'incident' && id) {
                  this.flyToIncident(lat, lng, id);
                } else {
                  this.flyToLocationWithPin(lat, lng, title, subtitle, '📍 Landmark');
                }
              });
            });
          } else {
            suggestionsDropdown.classList.add('hidden');
          }
        }
      });

      // Pressing ENTER directly redirects to that place or top suggestion
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const val = searchInput.value.trim();
          if (suggestionsDropdown) suggestionsDropdown.classList.add('hidden');
          if (val) {
            this.directToLocationOrLandmark(val);
          }
        }
      });

      // Hide suggestions when clicking outside
      document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !suggestionsDropdown?.contains(e.target)) {
          suggestionsDropdown?.classList.add('hidden');
        }
      });
    }

    // Timeframe Switchers
    document.querySelectorAll('.timeframe-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentTimeframe = btn.getAttribute('data-tf');
        document.querySelectorAll('.timeframe-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Hotspot Rows
    document.querySelectorAll('.hotspot-row').forEach(row => {
      row.addEventListener('click', () => {
        const lat = parseFloat(row.getAttribute('data-lat'));
        const lng = parseFloat(row.getAttribute('data-lng'));
        const name = row.getAttribute('data-name');
        if (!isNaN(lat) && !isNaN(lng)) {
          this.flyToIncident(lat, lng, name);
          document.querySelectorAll('.hotspot-row').forEach(r => r.classList.remove('active'));
          row.classList.add('active');
        }
      });
    });

    // Sort buttons in Table
    document.querySelectorAll('.sort-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.sortBy = btn.getAttribute('data-sort');
        this.render(document.getElementById('view-container'));
      });
    });

    // Fly to Location table buttons
    document.querySelectorAll('.btn-fly-to').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const lat = parseFloat(btn.getAttribute('data-lat'));
        const lng = parseFloat(btn.getAttribute('data-lng'));
        const id = btn.getAttribute('data-id');
        this.flyToIncident(lat, lng, id);
      });
    });

    // Pagination buttons
    document.querySelectorAll('.page-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (btn.disabled || btn.classList.contains('disabled')) return;
        const page = parseInt(btn.getAttribute('data-page'));
        if (!isNaN(page) && page >= 1) {
          this.currentPage = page;
          this.render(document.getElementById('view-container'));
          document.querySelector('.heatmap-table-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }
};

