export interface IPlaces {
    getDBLastUpdatedDate(databaseID: string): Promise<Date>;
}