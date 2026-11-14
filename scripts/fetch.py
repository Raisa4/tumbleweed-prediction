import json #reads the regions.json
import pandas as pd # as pd = nickname so i don't write pandas every single time
                    # library for handling tables
import requests

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


for r in json.load(open("data/regions.json")): #it takes the Raisa's json, scroll thru 3 cities and saves it in wind.csv
    print(r["id"])
    wind(r["bbox"]).to_csv(f"data/{r['id']}/wind.csv")

