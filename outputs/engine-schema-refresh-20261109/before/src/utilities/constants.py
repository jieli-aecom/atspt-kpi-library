"""Code-defined shared constants, seeded once by initiate and edited here."""

CONSTANTS: dict[str, object] = {}


def get_constant(name: str) -> object:
    """Return a named constant's value; unknown names raise KeyError."""
    return CONSTANTS[name]


# ID: variable-9c487987-29f1-4572-8085-7df09075f894
# Discount rate, TxDOT uses 3.1%
# Export default: '3.1%'; unit: %
CONSTANTS.setdefault('Discount Rate', 0.031)


# ID: variable-f674cb33-454e-4baa-878b-85276e91417d
# Year at which baseline VMT is calculated (for BCA purposes); TxDOT template uses 2022
# Export default: '2022'; unit: year
CONSTANTS.setdefault('Base Year', 2022)


# ID: variable-5a69327d-b1fe-41b0-9141-6dcbceaf4b85
# No-build growth rate of bike-ped trips; TxDOT uses 2.5% annual
# Export default: '2.5%'; unit: %
CONSTANTS.setdefault('Bike Ped Growth Rate', 0.025)


# ID: variable-624f354c-1523-49ee-aec3-6bc2d8a4702b
# No-build growth rate of auto trips; TxDOT uses 2.5% annual
# Export default: '2.5%'; unit:
CONSTANTS.setdefault('VMT Growth Rate', 0.025)


# ID: variable-4f57bc21-fa00-4a43-8482-23a8810eb9cb
# Noise externality in 2022 dollars per VMT, by default $0.128
# Export default: '$0.128'; unit: dollar per VMT
CONSTANTS.setdefault('Noise Externality Per VMT', 0.128)


# ID: variable-08c09214-9fa7-4108-a47a-a374b5541d37
# Safety externality in 2022 dollars per VMT, by default $0.038
# Export default: '$0.038'; unit: dollar per VMT
CONSTANTS.setdefault('Safety Externality Per VMT', 0.038)


# ID: variable-b62a244b-b04b-4cb4-96eb-d9ca32be5437
# Value of time for non-truck passengers in 2022 dollars, by default $19.6
# Export default: '$19.6'; unit: dollar per person
CONSTANTS.setdefault('All-Purpose VOT', 19.6)


# ID: variable-cf125e2b-2dfe-49f0-ac6f-17e5edca6cec
# Value of time for truck (drivers) in 2022 dollars, by default $33.5
# Export default: '$33.5'; unit: dollar per truck
CONSTANTS.setdefault('Truck VOT', 33.5)


# ID: variable-c2106e70-e7b4-4eda-970b-43e52beffbdf
# Light-duty vehicle operating cost per VMT in 2022 dollars, by default $0.52
# Export default: '$0.52'; unit: dollar per VMT
CONSTANTS.setdefault('Light-Duty Vehicle Operating Cost Per VMT', 0.52)


# ID: variable-d5bdf793-c271-41e2-a950-05f528372256
# Commercial truck vehicle operating cost per VMT in 2022 dollars, by default $1.32
# Export default: '$1.32'; unit: dollar per VMT
CONSTANTS.setdefault('Commercial Truck Operating Cost Per VMT', 1.32)


# ID: variable-569e27bc-7ada-4165-a7ea-56d9551c68d2
# % removed from vehicle trips due to added bike/ped trips; by default 89%
# Export default: '89%'; unit: %
CONSTANTS.setdefault('Bike Ped Removal Rate', 0.89)


# ID: variable-95206dad-0789-4853-bb3f-11f8260809fa
# % of bike riders who receive health benefits from biking; 59%
# Export default: '59%'; unit: %
CONSTANTS.setdefault('Bike Health Benefit Eligible Rate', 0.59)


# ID: variable-e3d51a40-9807-4314-8a60-fa48ee56e3eb
# % of pedestrians who receive health benefits from walking; 68%
# Export default: '68%'; unit: %
CONSTANTS.setdefault('Walk Health Benefit Eligible Rate', 0.68)


# ID: variable-dd6192b3-cbcb-4f2b-bab6-64b95d4b7f4a
# Bike health benefit per eligible trip in 2022 dollars; default $6.8
# Export default: '$6.8'; unit: dollar
CONSTANTS.setdefault('Bike Health Benefit Per Trip', 6.8)


# ID: variable-0f7f0322-47f9-4a77-ab35-192a6b698185
# Waling health benefit per eligible trip in 2022 dollars; default $7.63
# Export default: '$7.63'; unit:
CONSTANTS.setdefault('Walk Health Benefit Per Trip', 7.63)


# ID: variable-47868dc7-8442-41d7-8700-4a25f3db7b57
# Benefit brought by 1-ft sidewalk widening per person mile in 2022 dollar, $0.11
# Export default: '$0.11'; unit: dollar
CONSTANTS.setdefault('Sidewalk Benefit Per Person-Mile', 0.11)


# ID: variable-19395813-5cc7-4ba7-be4f-0da7c4166145
# Share of heavy-diesel truck VMT in all truck VMT
# Export default: '30%'; unit: %
CONSTANTS.setdefault('Heavy-Diesel Truck Share', 0.3)


# ID: variable-e18bed50-5ab9-46e9-ae63-8da8bb57a472
# No build congested time share of a link: 80% by default
# Export default: '80%'; unit: %
CONSTANTS.setdefault('NB Congested Share', 0.8)


# ID: variable-cae83a13-37a9-4353-bd32-c11e6b7503a5
# By default 1.48 persons in a non-truck (all-purpose) vehicle
# Export default: '1.48'; unit: person
CONSTANTS.setdefault('All-Purpose Occupancy', 1.48)


# ID: variable-f570cb98-7c90-4efb-b6da-612e92385415
# Congestion externality in 2022 dollars per VMT, by default $0.038
# Export default: '$0.038'; unit: dollar per VMT
CONSTANTS.setdefault('Congestion Externality Per VMT', 0.038)


# ID: variable-984df2c9-8163-4f50-b70e-b049f0e97bf9
# Benefit brought by adding bike facility per person mile in 2022 dollar, $1.86
# Export default: '$1.86'; unit:
CONSTANTS.setdefault('Bike Amenity Benefit Per Person-Mile', 1.86)


# ID: variable-15115d58-cd2e-4285-b590-a57edf4afc94
# Cost of traveling a vehicle mile
# Export default: '$0.655'; unit: dollar per VMT
CONSTANTS.setdefault('Cost Per Vehicle Mile', 0.655)


# ID: variable-465bb74f-7382-4f26-9c33-f54a4915e406
# Cost of traveling a vehicle hour (VoT)
# Export default: '$37.49'; unit: dollar per vehicle hour
CONSTANTS.setdefault('Cost Per Vehicle Hour', 37.49)


# ID: variable-4d662f2f-a3f1-497d-802f-37a6b3dbb49b
# Cost of an hour's work of a volunteer
# Export default: '$24.69'; unit: dollar
CONSTANTS.setdefault('Cost Per Volunteer Hour', 24.69)


# ID: variable-8c63c815-e530-41eb-821d-84a699d2ee9f
# Cost of lodging per person per day for a volunteer
# Export default: '$94'; unit: dollar
CONSTANTS.setdefault('Cost Per Lodging Day', 94)


# ID: variable-c9138396-3a48-4779-ab73-bb5619cee8cb
# Threshold of V/C beyond which a link is considered "not reliable"
# Export default: '0.8'; unit:
CONSTANTS.setdefault('Reliable Threshold', 0.8)


# ID: variable-92928d52-4f06-41bb-8127-beb1747f46b3
# BTU per kWh for electric vehicles
# Export default: '3412'; unit: BTU/kWh
CONSTANTS.setdefault('BTU Per KWH', 3412)


# ID: variable-07a1ef00-83e0-43cb-bbc6-d277b59d7f2e
# Threshold of bridge score beyond which the bridge is considered to be in good condition
# Export default: ''; unit: score
CONSTANTS.setdefault('Good Bridge Threshold', None)


# ID: variable-ba4c8bdb-da81-497a-ac2a-50a54f928078
# Threshold of bridge score under which the bridge is considered to be in bad condition
# Export default: ''; unit:
CONSTANTS.setdefault('Bad Bridge Threshold', None)


# ID: variable-3d8e4b22-07ef-4a77-a61d-1ceb7a2d4080
# Threshold of pavement score beyond which the pavement is considered to be in good condition
# Export default: ''; unit:
CONSTANTS.setdefault('Good Pavement Threshold', None)


# ID: variable-97bec616-bda9-4888-871c-a455778a4baf
# Threshold of pavement score under which the pavement is considered to be in bad condition
# Export default: ''; unit:
CONSTANTS.setdefault('Bad Pavement Threshold', None)
