// scripts/api-ingest-v3.ts
const API_URL = "https://game-five-kohl.vercel.app/api/ingest/match";

const payloads = [
  {
    "source": "lcu",
    "uploaderPuuid": "e1d87b48-7323-5fda-9fb9-d2564745c736",
    "gameId": 7874749978,
    "gameCreation": 1780446529499,
    "gameDuration": 868,
    "queueId": 2400,
    "gameMode": "KIWI",
    "mapId": 12,
    "participants": [
        {"participantId": 1, "teamId": 100, "championId": 34, "stats": {"win": true, "kills": 8, "deaths": 3, "assists": 25, "totalDamageDealtToChampions": 27593, "totalHeal": 3117, "goldEarned": 16293}, "puuid": "a7f7710a-7c89-5784-ad4f-0d65e7eede57", "gameName": "El Tamator", "tagLine": "EUW"},
        {"participantId": 2, "teamId": 100, "championId": 35, "stats": {"win": true, "kills": 7, "deaths": 4, "assists": 22, "totalDamageDealtToChampions": 19263, "totalHeal": 1003, "goldEarned": 12704}, "puuid": "2a7f2cd2-6fba-5038-a377-699f342c4d35", "gameName": "AIS Exile", "tagLine": "EUW"},
        {"participantId": 3, "teamId": 100, "championId": 31, "stats": {"win": true, "kills": 6, "deaths": 4, "assists": 19, "totalDamageDealtToChampions": 15058, "totalHeal": 10400, "goldEarned": 12172}, "puuid": "5e39752e-8650-58aa-a9f8-a6a071b8a653", "gameName": "Snitchblasta56", "tagLine": "9380"},
        {"participantId": 4, "teamId": 100, "championId": 92, "stats": {"win": true, "kills": 5, "deaths": 7, "assists": 24, "totalDamageDealtToChampions": 26586, "totalHeal": 3901, "goldEarned": 12543}, "puuid": "dafeef65-0ea1-52d4-bf39-7ecbfc589d72", "gameName": "Kadash", "tagLine": "TOP"},
        {"participantId": 5, "teamId": 100, "championId": 104, "stats": {"win": true, "kills": 19, "deaths": 8, "assists": 17, "totalDamageDealtToChampions": 63574, "totalHeal": 3062, "goldEarned": 15687}, "puuid": "e1d87b48-7323-5fda-9fb9-d2564745c736", "gameName": "Aristo", "tagLine": "Risto"},
        {"participantId": 6, "teamId": 200, "championId": 202, "stats": {"win": false, "kills": 10, "deaths": 8, "assists": 11, "totalDamageDealtToChampions": 25066, "totalHeal": 488, "goldEarned": 13988}, "puuid": "0063a383-8f7b-5ab4-ae1a-d42b5831bb75", "gameName": "Itchy Finger", "tagLine": "EUW"},
        {"participantId": 7, "teamId": 200, "championId": 16, "stats": {"win": false, "kills": 3, "deaths": 4, "assists": 19, "totalDamageDealtToChampions": 7433, "totalHeal": 19321, "goldEarned": 11268}, "puuid": "3f2e7fcf-3588-52a5-9c82-c496637ed660", "gameName": "iNoXaH Banchamek", "tagLine": "EUW"},
        {"participantId": 8, "teamId": 200, "championId": 72, "stats": {"win": false, "kills": 1, "deaths": 10, "assists": 13, "totalDamageDealtToChampions": 7844, "totalHeal": 1834, "goldEarned": 10484}, "puuid": "376e050f-e47f-5da2-88c8-95488b8e7217", "gameName": "d\u00EDe for me", "tagLine": "EUW"},
        {"participantId": 9, "teamId": 200, "championId": 12, "stats": {"win": false, "kills": 4, "deaths": 11, "assists": 19, "totalDamageDealtToChampions": 19900, "totalHeal": 11570, "goldEarned": 11888}, "puuid": "9b85a04d-2176-5d4f-ba41-5097f3d58304", "gameName": "AdoRe", "tagLine": "jxstn"},
        {"participantId": 10, "teamId": 200, "championId": 67, "stats": {"win": false, "kills": 8, "deaths": 12, "assists": 7, "totalDamageDealtToChampions": 16505, "totalHeal": 2267, "goldEarned": 11941}, "puuid": "9d4233de-fb2f-5345-8484-ebf6903a023d", "gameName": "Chinglish", "tagLine": "11451"}
    ],
    uploaderPuuid: "e1d87b48-7323-5fda-9fb9-d2564745c736"
  },
  {
    "source": "lcu",
    "uploaderPuuid": "e1d87b48-7323-5fda-9fb9-d2564745c736",
    "gameId": 7874746474,
    "gameCreation": 1780445245836,
    "gameDuration": 874,
    "queueId": 2400,
    "gameMode": "KIWI",
    "mapId": 12,
    "participants": [
        {"participantId": 1, "teamId": 100, "championId": 78, "stats": {"win": false, "kills": 4, "deaths": 9, "assists": 20, "totalDamageDealtToChampions": 20128, "totalHeal": 13119, "goldEarned": 11086}, "puuid": "cfc3afbf-3a2d-5ee5-a861-56f3f1ed374f", "gameName": "TixBelgium", "tagLine": "EUW"},
        {"participantId": 2, "teamId": 100, "championId": 804, "stats": {"win": false, "kills": 6, "deaths": 9, "assists": 23, "totalDamageDealtToChampions": 35784, "totalHeal": 1211, "goldEarned": 12720}, "puuid": "3cf18a98-426b-54fc-8b02-5805f5689f26", "gameName": "cabaobuyongzhi", "tagLine": "EUW"},
        {"participantId": 3, "teamId": 100, "championId": 45, "stats": {"win": false, "kills": 4, "deaths": 10, "assists": 20, "totalDamageDealtToChampions": 17105, "totalHeal": 696, "goldEarned": 12117}, "puuid": "6692fd78-a608-5da4-89ce-739c4cc9032e", "gameName": "BWMZLT", "tagLine": "EUW"},
        {"participantId": 4, "teamId": 100, "championId": 122, "stats": {"win": false, "kills": 7, "deaths": 12, "assists": 20, "totalDamageDealtToChampions": 24135, "totalHeal": 12780, "goldEarned": 12141}, "puuid": "89328a35-493e-52fc-b576-ecec12b7ae4f", "gameName": "Evelemon", "tagLine": "999"},
        {"participantId": 5, "teamId": 100, "championId": 202, "stats": {"win": false, "kills": 11, "deaths": 12, "assists": 15, "totalDamageDealtToChampions": 27949, "totalHeal": 432, "goldEarned": 13279}, "puuid": "c27ea69f-52b4-5a36-822f-38b5ecc92943", "gameName": "D1e", "tagLine": "EUW"},
        {"participantId": 6, "teamId": 200, "championId": 235, "stats": {"win": true, "kills": 14, "deaths": 4, "assists": 28, "totalDamageDealtToChampions": 18553, "totalHeal": 11000, "goldEarned": 14413}, "puuid": "96617896-c43d-55d8-bdeb-a40fb19d874d", "gameName": "The human Hank", "tagLine": "EUW"},
        {"participantId": 7, "teamId": 200, "championId": 799, "stats": {"win": true, "kills": 23, "deaths": 12, "assists": 18, "totalDamageDealtToChampions": 43715, "totalHeal": 8927, "goldEarned": 15311}, "puuid": "63e3c461-3e98-536f-8bce-e0f0b2a3d097", "gameName": "ionjii", "tagLine": "7654"},
        {"participantId": 8, "teamId": 200, "championId": 77, "stats": {"win": true, "kills": 9, "deaths": 6, "assists": 23, "totalDamageDealtToChampions": 70333, "totalHeal": 4621, "goldEarned": 13445}, "puuid": "58797ce4-b483-5cee-a3e6-f6c76b721bfa", "gameName": "GrandLift", "tagLine": "ADC"},
        {"participantId": 9, "teamId": 200, "championId": 14, "stats": {"win": true, "kills": 4, "deaths": 6, "assists": 22, "totalDamageDealtToChampions": 23140, "totalHeal": 9575, "goldEarned": 12369}, "puuid": "e1d87b48-7323-5fda-9fb9-d2564745c736", "gameName": "Aristo", "tagLine": "Risto"},
        {"participantId": 10, "teamId": 200, "championId": 40, "stats": {"win": true, "kills": 2, "deaths": 4, "assists": 42, "totalDamageDealtToChampions": 10161, "totalHeal": 21217, "goldEarned": 12340}, "puuid": "f2ef5fac-76c7-584c-b8fc-eb3471b66fb1", "gameName": "Okkio", "tagLine": "ETU"}
    ],
    uploaderPuuid: "e1d87b48-7323-5fda-9fb9-d2564745c736"
  }
];

async function ingest() {
    for (const payload of payloads) {
        console.log(`Ingesting match ${payload.gameId}...`);
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': 'Bearer game-five-383' 
            },
            body: JSON.stringify(payload)
        });
        console.log(`Result: ${response.status} ${await response.text()}`);
    }
}

ingest();
