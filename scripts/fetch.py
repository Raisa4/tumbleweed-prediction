import json #reads the regions.json
import pandas as pd # as pd = nickname so i don't write pandas every single time
                    # library for handling tables
import requests
import xarray as xr

POWER = "https://power.larc.nasa.gov/api/temporal/hourly/point" # nasa's web address for hourly data

# downloads one season of data
#Hourly 10 m wind
def season(lon, lat, year):
    r = requests.get(POWER, timeout=300, params={
        "parameters": "WS10M,WD10M", "community": "RE", "longitude": lon, "latitude": lat,
        "start": max(f"{year - 1}1101", "20010101"), "end": f"{year}0430", "time-standard": "UTC", "format": "JSON"})
    r.raise_for_status()
    p = r.json()["properties"]["parameter"]
    return pd.DataFrame({"speed_ms": p["WS10M"], "dir_from": p["WD10M"]})

#clean the rows that represent missing hours
def wind(bbox):
    #Hourlywind at the bbox centre (the rectangle that the city is in); dir_deg = direction blowing toward
    lon, lat = (bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2
    df = pd.concat(season(lon, lat, y) for y in range(2001, 2026))
    df = df[(df >= 0).all(axis=1)]
    df.index = pd.to_datetime(df.index, format="%Y%m%d%H").rename("time")
    df["dir_deg"] = (df.pop("dir_from") + 180) % 360
    return df


def windy_days(bbox):
    # Days per Nov–Apr season with daily max 10 m wind >= 8 m/s
    lon, lat = (bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2
    r = requests.get("https://power.larc.nasa.gov/api/temporal/daily/point", timeout=300, params={
        "parameters": "WS10M_MAX", "community": "RE", "longitude": lon, "latitude": lat,
        "start": "20001101", "end": "20250430", "format": "JSON"})
    r.raise_for_status()
    s = pd.Series(r.json()["properties"]["parameter"]["WS10M_MAX"])
    s.index = pd.to_datetime(s.index, format="%Y%m%d")
    assert (s >= 0).all()
    s = s[s.index.month.isin([11, 12, 1, 2, 3, 4])]
    return (s >= 8).groupby(s.index.year + (s.index.month >= 11)).sum()


OPEN_LAND = [7, 10, 16] # open shrubland, grassland, barren


def barren_frac(rid):
    # Yearly fraction of valid land-cover pixels that are open shrub, grassland or barren
    lc = xr.open_dataset(f"data/raw/appeears/{rid}/MCD12Q1.061_500m_aid0001.nc")["LC_Type1"]
    frac = lc.isin(OPEN_LAND).where(lc.notnull()).mean(["lat", "lon"])
    return pd.Series(frac.values, index=lc.time.dt.year.values)


def monthly(path):
    # Giovanni area-averaged time series CSV to monthly Series
    s = pd.read_csv(path, skiprows=8, index_col=0, parse_dates=True).iloc[:, 0]
    assert (s > -9999).all()
    return s


def spring_precip(rid):
    # Mar–May total precipitation, mm (Giovanni)
    s = monthly(f"data/raw/giovanni/{rid}_precip.csv")
    s = s[s.index.month.isin([3, 4, 5])]
    return s.groupby(s.index.year).sum()


def autumn_soilm(rid):
    # Sep–Nov mean 0–10 cm soil moisture, kg/m² (Giovanni)
    s = monthly(f"data/raw/giovanni/{rid}_soilm.csv")
    s = s[s.index.month.isin([9, 10, 11])]
    return s.groupby(s.index.year).mean()


def peak_ndvi_anom(rid):
    # Yearly peak NDVI over open-land pixels (good-quality only), minus the 2001–2025 mean
    d = f"data/raw/appeears/{rid}"
    ndvi = xr.open_dataset(f"{d}/ndvi.nc")["_250m_16_days_NDVI"]
    good = xr.open_dataset(f"{d}/MOD13Q1.061_250m_aid0001.nc")["_250m_16_days_pixel_reliability"] <= 1
    lc = xr.open_dataset(f"{d}/MCD12Q1.061_500m_aid0001.nc")["LC_Type1"].isel(time=0)
    open_land = lc.isin(OPEN_LAND).reindex_like(ndvi, method="nearest")
    peak = ndvi.where(good & open_land).mean(["lat", "lon"]).groupby("time.year").max().sel(year=slice(2001, 2025))
    return (peak - peak.mean()).to_series()


def annual(r):
    # All five yearly variables for one region, as year,variable,value rows
    rid = r["id"]
    a = pd.concat({
        "spring_precip": spring_precip(rid),
        "peak_ndvi_anom": peak_ndvi_anom(rid),
        "autumn_soilm": autumn_soilm(rid),
        "windy_days": windy_days(r["bbox"]),
        "barren_frac": barren_frac(rid),
    }, names=["variable", "year"]).rename("value").reset_index()[["year", "variable", "value"]]
    grid = a.pivot(index="year", columns="variable", values="value")
    assert list(grid.index) == list(range(2001, 2026)) and grid.shape == (25, 5) and grid.notna().all().all()
    return a


for r in json.load(open("data/regions.json")): # Raisa's list of the 3 regions → wind.csv + annual.csv for each
    print(r["id"])
    wind(r["bbox"]).to_csv(f"data/{r['id']}/wind.csv")
    annual(r).to_csv(f"data/{r['id']}/annual.csv", index=False)

