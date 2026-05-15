export interface WorkCategory {
  label: string;
  subcategories: string[];
}

export const WORKER_CATEGORIES: WorkCategory[] = [
  {
    label: 'Construction & Project Workers',
    subcategories: ['Mason / Rajmistri','Carpenter','Painter / Polisher','Plumber','Electrician','Welder','Fabricator','Tile / Marble / Granite Worker','General Labour / Site Helper','Steel Fixer / Bar Bender','POP / Gypsum Worker','Glass & Aluminium Worker','Waterproofing Worker','Road Construction Worker','Shuttering Carpenter','Civil Helper','Other Construction Work'],
  },
  {
    label: 'Manufacturing & Industrial Workers',
    subcategories: ['Machine Operator','CNC Operator','Lathe Operator','Fitter','Assembly Line Worker','Quality Inspector','Packing Worker','Helper / Labour','Production Supervisor','Store Keeper','Maintenance Technician','Welder (MIG/TIG/ARC)','HVAC / AC Technician','Other Industrial Work'],
  },
  {
    label: 'Agriculture & Farming Workers',
    subcategories: ['Farmer','Tractor Driver','Harvester Operator','Irrigation Worker','Cattle Care Worker','Dairy Worker','Seasonal Farm Labour','Greenhouse Worker','Farm Labour','Animal Care Worker','Crop Cutting Labour','Farm Equipment Operator','Other Agriculture Work'],
  },
  {
    label: 'Event & Decoration Workers',
    subcategories: ['Event Helper','Stage Setup Worker','Tent Worker','Decoration Worker','Catering Staff','Cleaner','Event Coordinator','Flower Decoration Worker','Wedding Setup Worker','Balloon Decoration Worker','Event Marketing Promoter'],
  },
  {
    label: 'Household & Domestic Workers',
    subcategories: ['Maid','Cook','Cleaner','Babysitter','Gardener','Elderly Caregiver','Housekeeper','Pet Care Worker','Home Nurse','Laundry Worker','Caretaker','Household Helper'],
  },
  {
    label: 'Hospitality & Service Workers',
    subcategories: ['Waiter','Hotel Receptionist','Kitchen Helper','Chef Assistant','Steward','Barista','Housekeeping Staff','Catering Staff','Bakery Assistant','Fast Food Worker','Pantry Staff','Room Service Staff','Banquet Staff','Other Hospitality Work'],
  },
  {
    label: 'Transport & Logistics Workers',
    subcategories: ['Truck Driver','Tempo Driver','Auto Driver','Cab Driver','Delivery Boy','Courier Boy','Loading Labour','Unloading Labour','Warehouse Worker','Forklift Operator','Picker & Packer','Bus Driver','Trailer Driver','Delivery Partner (E-commerce)','Driver (LMV)','Driver (HMV)','E-Rickshaw Driver','Other Driving Work'],
  },
  {
    label: 'Retail & Shop Workers',
    subcategories: ['Salesman','Cashier','Store Helper','Stock Boy','Billing Assistant','Packing Boy','Delivery Boy (Retail)','Floor Supervisor','Store Manager','Customer Support Staff','Shelf Arranger','Sales Boy','Sales Girl','Other Retail Work'],
  },
  {
    label: 'Skilled Technical Workers',
    subcategories: ['AC Technician','Refrigerator Technician','Mobile Repair Technician','Two-Wheeler Mechanic','Four-Wheeler Mechanic','CCTV Installer','RO/Water Purifier Technician','Solar Panel Technician','Electric Motor Rewinding Technician','Lift/Elevator Technician','DG Generator Technician','Battery Technician','Other Technical Work'],
  },
  {
    label: 'Specialized & Creative Workers',
    subcategories: ['Tailor','Fashion Designer','Beautician','Barber / Hairdresser','Photographer','Artist / Painter','Furniture Carpenter','Interior Worker','Graphic Designer','Mehndi Artist','Makeup Artist','Handicraft Worker','Other Specialized Work'],
  },
  {
    label: 'Automobile & Workshop Workers',
    subcategories: ['Mechanic (2W/4W)','Helper Mechanic','Denter','Automobile Painter','Tyre Mechanic','Wheel Alignment Technician','AC Mechanic (Vehicle)','Car Washer','Other Automobile Work'],
  },
  {
    label: 'Healthcare Support Workers',
    subcategories: ['Ward Boy','Nursing Helper','Patient Care','Hospital Cleaner','Medical Attendant','Pharmacy Helper','Other Healthcare Support'],
  },
  {
    label: 'Security & Facility Worker',
    subcategories: ['Security Guard','CCTV Operator','Office Boy','Facility Cleaner','Sweeper','Lift Operator','Gatekeeper','Watchman','Other Facility Work'],
  },
];

export const ALL_WORK_TYPES = WORKER_CATEGORIES.flatMap((c) => c.subcategories);
