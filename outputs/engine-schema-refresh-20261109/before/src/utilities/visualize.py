from keplergl import KeplerGl
import webbrowser
import geopandas as gpd
import pandas as pd
import h3

def kepler_visualize(*data, **options):
    """
    Docstring for kepler_visualize
    
    :param data: data to be added. 
        - Each must either be a pd.DataFrame with `h3_index` column or a gpd.GeoDataFrame
        - If it's a pd.DataFrame, the `h3_index` column must contain valid H3 indexes.
          This function will not validate them.
        - If it's a gpd.GeoDataFrame, it must have valid geometries.

    :param options:
        - data_names: list of names for each data argument. If not provided, default names are: data_0, data_1, etc.
        - center_latlon: tuple of (latitude, longitude) to center the map. 
          If not provided, the center of the first data will be used. This might incur some overhead.
        - zoom: initial zoom level for the map. Default is 6.
    """

    # All data must either be a pd.DataFrame with `h3_index` column or a gpd.GeoDataFrame
    if len(data) == 0:
        raise ValueError("At least one data argument must be provided.")
    
    for d in data:
        if not (isinstance(d, gpd.GeoDataFrame) or 
                (isinstance(d, pd.DataFrame) and "h3_index" in d.columns)):
            raise ValueError("All data must either be a gpd.GeoDataFrame or a pd.DataFrame with an 'h3_index' column.")

    # `data_names` in options?
    data_names = options.get("data_names", [])
    if len(data_names) != len(data):
        # Invent default names
        used_names = [f"data_{i}" for i in range(len(data))]
    else:
        used_names = data_names

    # Center latlon in options? If not, use the center of the first data
    center_latlon = options.get("center_latlon", None)
    invalid = center_latlon is None or not (isinstance(center_latlon, tuple) and len(center_latlon) == 2)
    
    if invalid:
        first_data = data[0]
        if isinstance(first_data, gpd.GeoDataFrame):
            centroids = first_data.geometry.to_crs(3857).centroid.to_crs(4326)
            center_latlon = (centroids.y.mean(), centroids.x.mean())
        else:
            latlons = first_data['h3_index'].apply(h3.cell_to_latlng).apply(pd.Series)
            center_latlon = (latlons[0].mean(), latlons[1].mean())

    # Zoom level in options?
    zoom = options.get("zoom", 6)


    config = {
        "version": "v1",
        "config": {
                "mapState": {
                    "latitude": center_latlon[0], 
                    "longitude": center_latlon[1], 
                    "zoom": zoom
                },
            }
    }
    m = KeplerGl()
    for name, data in zip(used_names, data):
        m.add_data(data=data, name=name)

    m.config = config
    m.save_to_html(file_name="kepler.html")
    webbrowser.open("kepler.html")
