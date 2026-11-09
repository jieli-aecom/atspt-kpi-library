"""Code-defined domains, seeded once by initiate and edited here."""

DOMAINS: dict[str, list[str]] = {}


def get_domain(name: str) -> list[str]:
    """Return a copy of a domain's options; unknown names raise KeyError."""
    return list(DOMAINS[name])


# ID: value-enum-6f8ee80d-5a58-4bc5-9a86-6d10f2e2b2f6
DOMAINS.setdefault('Facility Type', ['Interstate', 'Non Interstate NHS', 'Other'])


# ID: value-enum-784bb217-5d24-45c4-bbb4-5eea9f48e800
DOMAINS.setdefault('Area Access Type', ['Rural Restricted', 'Rural Unrestricted', 'Urban Restricted', 'Urban Unrestricted'])


# ID: value-enum-94057274-bae2-4f42-b6b4-c3c3746d9bde
DOMAINS.setdefault('Crash Type', ['Non-Intersection', 'Intersection', 'Pedestrian Cyclist', 'Object Struck', 'Blank'])


# ID: value-enum-3ca2a1e8-fd34-4430-90fc-76979a25ed65
DOMAINS.setdefault('Crash Severity', ['K', 'A', 'B', 'C', 'O'])


# ID: value-enum-48f3f244-5ec7-4e88-a1f0-e595d3a6d2fb
DOMAINS.setdefault('Crash Commercial Vehicle', ['Involving', 'Non Involving'])


# ID: value-enum-798c5c8a-4a71-4ff7-8239-2e0652dc3cc5
DOMAINS.setdefault('Vehicle Type', ['Multi-Vehicle', 'Single-Vehicle', 'Driveway', 'Pedestrian', 'Bike'])


# ID: value-enum-5b831e88-c6fa-44fc-815e-c0419ece8523
DOMAINS.setdefault('Flood Interval', ['1', '5', '10', '25', '50', '100', '500', '1000'])


# ID: value-enum-c80b60a6-de9a-462f-bc31-0ed47a556338
DOMAINS.setdefault('Level of Mobility', ['Tolerable', 'Moderate', 'Serious', 'Severe'])


# ID: value-enum-08993854-ce40-403b-a2b2-cc6b069dba54
DOMAINS.setdefault('Period', ['AM', 'PM', 'MD', 'OV'])


# ID: value-enum-080f4100-bb59-49fc-ad34-58042caa62d7
DOMAINS.setdefault('Emission Type', ['VOC', 'NOx', 'GHG', 'CO', 'PM2.5'])


# ID: value-enum-96ef482f-0c85-4df1-910d-a1b76d05a658
# **Crash type = 1 - Non-Intersection**:
# | Code | Project type |
# |---:|---|
# | 101 | Install Warning/Guide Signs |
# | 113 | Install Delineators |
# | 114 | Install School Zones |
# | 119 | Install Overhead Signs |
# | 123 | Install Advance Warning Signals—Curve |
# | 125 | Install Advance Warning Signals and Signs—Curve |
# | 130 | Install Advance Warning Signs—Curve with existing warning signals |
# | 133 | Improve School Zone |
# | 136 | Install LED Flashing Chevrons—Curve |
# | 137 | Install Chevrons |
# | 139 | Install Surface-Mounted Delineators on Centerline |
# | 201 | Install Median Barrier |
# | 203 | Install Raised Median |
# | 204 | Flatten Side Slope |
# | 209 | Safety Treat Fixed Objects |
# | 218 | Widen Bridge |
# | 303 | Resurfacing |
# | 304 | Safety Lighting |
# | 306 | High-Friction Surface Treatment—Curve |
# | 401 | Install Pavement Markings |
# | 402 | Install Edge Marking |
# | 404 | Install Centerline Striping |
# | 502 | Widen Lane(s) |
# | 503 | Widen Paved Shoulder to 5 ft or less |
# | 504 | Construct Paved Shoulders, 1–4 ft |
# | 505 | Improve Vertical Alignment |
# | 506 | Improve Horizontal Alignment |
# | 507 | Increase Superelevation |
# | 516 | Close Crossover |
# | 517 | Add Through Lane |
# | 518 | Install Continuous Turn Lane |
# | 525 | Convert to One-Way Frontage Roads |
# | 532 | Milled Edge-Line Rumble Strips |
# | 533 | Profile Edge-Line Markings |
# | 534 | Raised Edge-Line Rumble Strips |
# | 536 | Widen Paved Shoulders to more than 5 ft |
# | 537 | Construct Paved Shoulders greater than 5 ft |
# | 538 | Convert 2-Lane Facility to 4-Lane Divided |
# | 540 | Install Passing Lanes on 2-Lane Road |
# | 541 | Provide Additional Paved Surface Width |
# | 542 | Milled Centerline Rumble Strips |
# | 543 | Profile Centerline Markings |
# | 544 | Raised Centerline Rumble Strips |
#
# **Crash type = 2 - Intersection**:
# | Code | Project type |
# |---:|---|
# | 105 | Install Intersection Flashing Beacon |
# | 107 | Install Traffic Signal |
# | 108 | Improve Traffic Signals |
# | 111 | Interconnect Signals |
# | 122 | Install Advance Warning Signals—Intersection |
# | 124 | Install Advance Warning Signals and Signs—Intersection |
# | 128 | Install Advance Warning Signs—Intersection with existing warning signals |
# | 138 | Install Flashing Yellow Arrow |
# | 305 | Safety Lighting at Intersection |
# | 307 | High-Friction Surface Treatment—Intersection |
# | 510 | Construct Turn Arounds |
# | 514 | Grade Separation |
# | 515 | Construct Interchange |
# | 519 | Add Left-Turn Lane |
# | 520 | Lengthen Left-Turn Lane |
# | 521 | Add Right-Turn Lane |
# | 522 | Lengthen Right-Turn Lane |
# | 545 | Transverse Rumble Strips |
# | 547 | Construct a Roundabout |
#
# **Crash type = 3 - Pedestrian Cyclist**:
# | Code | Project type |
# |---:|---|
# | 110 | Install Pedestrian Signal |
# | 118 | Replace Flashing Beacon with a Traffic Signal |
# | 131 | Improve Pedestrian Signals |
# | 132 | Install Advance Warning Signals and Signs |
# | 403 | Install Pedestrian Crosswalk |
# | 407 | Install Sidewalks |
# | 523 | Construct Pedestrian Over/Under Pass |
#
# **Crash type = 4 - Object Struck**:
# | Code | Project type |
# |---:|---|
# | 217 | Install Impact Attenuation System |
#
# **Crash type = 5 - Blank**:
# | Code | Project type |
# |---:|---|
# | 0 | Blank |
DOMAINS.setdefault('Crash Improvement Project Type', [])


# ID: value-enum-5d6ae5d8-41b7-4da3-9218-e7c537fbb5a2
# | Code | Strategy |
# |---:|---|
# | 0 | Blank |
# | 1 | Acceleration/Deceleration Lanes (Speed Change Lane) |
# | 2 | Access Management |
# | 3 | Bottleneck Removal |
# | 4 | Freight Shuttle System |
# | 5 | Grade Separation |
# | 6 | Managed HOT/HOV Lanes |
# | 7 | Adding New Lanes or Roads |
# | 8 | Adding New Toll Roads |
# | 9 | Ramp Configuration |
# | 10 | Temporary Shoulder Use |
# | 11 | Bicycle Lanes |
# | 12 | Bicycle-Pedestrian Education and Encouragement |
# | 13 | Bike Sharing |
# | 14 | Cycle Tracks |
# | 15 | Multimodal Transportation Center (Corridors) |
# | 16 | Pedestrian Connections |
# | 17 | Active Traffic Management |
# | 18 | Diverging Diamond Intersection |
# | 19 | Dynamic Rerouting |
# | 20 | Dynamic Truck Restrictions |
# | 21 | Queue Warning |
# | 22 | Ramp Flow Control |
# | 23 | Variable Speed Limits |
# | 24 | Pay to Drive Off-Peak |
# | 25 | Pay-As You-Drive Auto Insurance |
# | 26 | Variable Pricing |
# | 27 | Parking Management |
# | 28 | Construction Contracting Options |
# | 29 | Pavement Recycling |
# | 30 | Reducing Construction/Maintenance Disruption |
# | 31 | Shoulder Pavement Upgrades |
# | 32 | Sustainable Pavements |
# | 33 | Continuous Flow Intersections |
# | 34 | Median U-Turns |
# | 35 | Quadrant Intersections |
# | 36 | Roundabouts |
# | 37 | Intersection Turn Lanes |
# | 38 | Loop Ramps Reducing Left Turns |
# | 39 | One-Way Streets |
# | 40 | Superstreets |
# | 41 | Freight Rail Improvements |
# | 42 | Commercial Vehicle Accommodations |
# | 43 | Truck Incentives & Use Restrictions |
# | 44 | Truck Lane Restrictions |
# | 45 | Signal Operations & Management |
# | 46 | Aggressive Incident Clearance |
# | 47 | Special Event Management |
# | 48 | Road Weather Management |
# | 49 | Electronic Toll Collection Systems |
# | 50 | Reversible Traffic Lanes (Changeable Lane Assignments) |
# | 51 | Traffic Management Centers |
# | 52 | Traveler Information Systems |
# | 53 | Integrated Corridor Management |
# | 54 | Express Bus Service |
# | 55 | Park-and-Ride Lots |
# | 56 | Heavy Rail |
# | 57 | Commuter Rail |
# | 58 | Light Rail |
# | 59 | Bus Rapid Transit |
# | 60 | Local Bus Service |
# | 61 | Circulator Bus Transit |
# | 62 | Demand Response Transit |
# | 63 | Rural Transit |
# | 64 | Technology-Based Transit Improvements |
# | 65 | Fare Strategies |
# | 66 | Multimodal Transportation Centers |
# | 67 | Active Demand Management |
# | 68 | Carpooling |
# | 69 | Real-Time Ridesharing |
# | 70 | Vanpooling |
# | 71 | Flexible Work Hours |
# | 72 | Compressed Work Weeks |
# | 73 | Telecommuting |
# | 74 | Transportation Management Associations |
# | 75 | Trip Reduction Options |
# | 76 | State Employee Trip Reduction |
DOMAINS.setdefault('Delay Reduction Project Type', [])


# ID: value-enum-08281877-b97b-41d2-bc30-842d1e5ae470
DOMAINS.setdefault('Land Use', ['Single Family Residential',
 'Mobile Homes',
 'Multi-Family Residential',
 'Condo Residential',
 'Group Quarters',
 'Commercial Retail',
 'Government',
 'Educational',
 'Hotel Motel',
 'Hospital',
 'Office',
 'Industrial',
 'Storage Warehouse',
 'Recreational',
 'Other',
 'Agriculture',
 'Unknown',
 'Mixed Use',
 'Vacant Developable',
 'Parks Open Space',
 'Undevelopable',
 'Restaurants'])


# ID: value-enum-bc070ecd-644e-4c0f-bc7b-a1c3bf2a0f9a
DOMAINS.setdefault('Crash Road Type', ['2U', '3T', '4U', '4D', '5T'])


# ID: value-enum-9e543e30-1e5b-4129-8362-a9517532ed4c
DOMAINS.setdefault('Cross Section Type', ['Divided', 'Undivided'])


# ID: value-enum-a9ad3c0e-1a8b-43aa-93a0-9567fe666c04
DOMAINS.setdefault('Median Type', ['Median', 'No Median'])


# ID: value-enum-5488775d-a647-4ff2-bac9-a40583a0da4e
DOMAINS.setdefault('Speed Bin', [])


# ID: value-enum-2df2f857-0357-4a6b-90f5-007930b9dd1c
DOMAINS.setdefault('Occupancy Mode', ['Transit', 'SOV', 'HOV'])


# ID: value-enum-ebac4f54-d3e4-48d3-8ba2-71b77c7dff1a
DOMAINS.setdefault('Power Type', ['Electric', 'Non Electric'])


# ID: value-enum-7f7fc09d-0a83-41c7-b0a1-c03ec4fe9c05
DOMAINS.setdefault('Mode', ['Reg SOV',
 'Reg HOV',
 'Reg Med Truck',
 'Reg Heavy-Duty Truck',
 'CAV SOV',
 'CAV HOV',
 'CAV Med Truck',
 'CAV Heavy-Duty Truck',
 'TNC',
 'ZOV'])


# ID: value-enum-4c72b68e-6308-499e-935f-6c55c5e7585d
# Distance segments
DOMAINS.setdefault('Distance Band', [])


# ID: value-enum-cf44ee51-0969-43ea-ba78-9ba4348a9927
# Cost per trip band segments
DOMAINS.setdefault('Cost Band', [])


# ID: value-enum-ac0ea385-f6f1-47e2-b42d-6e09be5d2384
DOMAINS.setdefault('Interstate Status', ['Interstate', 'Non Interstate'])


# ID: value-enum-3e7c21c1-4180-432a-aa02-e0816ee18184
DOMAINS.setdefault('Roadway Class', ['Fringe Rural', 'L2 L3 Suburban', 'L4 L5 Suburban', 'Urban Core'])
