import requests
import tqdm

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


for e in tqdm.tqdm(data["hits"]["hits"], desc="Processing investigations"):

    id = e["_source"]["Accession"]

    url = f"{BASE_URL}/investigations/{id}"

    response = requests.get(url, timeout=30)
    response.raise_for_status()

    investigation = response.json()

    # The experimentalTable has a list of the .csv
    for exp in investigation.get("experimentalTable", []):

        urlTable = f"https://psi.nasa.gov/geode-py/ws/studies/{id}/download?file={exp['_id']["$oid"]}&version={exp['version']}&redirect=false"

        responseTable = requests.get(urlTable)
        responseTable.raise_for_status()

        urlAWS = responseTable.content
        responseAWS = requests.get(urlAWS, stream=True, timeout=60)
        responseAWS.raise_for_status()

        with open(exp["file_name"], "wb") as f:
            for chunk in responseAWS.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
