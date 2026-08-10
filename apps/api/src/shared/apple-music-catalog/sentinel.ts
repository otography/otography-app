// tx 内でカタログエンティティ（song/artist）が見つからず、事前 fetch もしていない場合に返す
export const catalogEntityMissingInTx = Symbol("catalog-entity-missing-in-tx");
