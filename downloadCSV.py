import requests

BASE_URL = "https://psi.nasa.gov/geode-py/ws/repo"

params = {
    "source": "psi",
    "type": "investigation",
    "ffield": "Research Area",
    "fvalue": "combustion science",
    "sort": "Public Release Date",
    "order": "desc",
    "size": 200,
}


with requests.Session() as session:
    response = session.get(
        f"{BASE_URL}/search",
        params=params,
        timeout=30,
    )

    response.raise_for_status()

    data = response.json()


for e in data["hits"]["hits"]:
    print(e["_source"]["Title"])
