item = input("Nom de l'item:")
prix = float(input("Prix de l'item:"))

TPS = 0.05
TVQ = 0.09975

part_TPS = prix * TPS
part_TVQ = prix * TVQ
prix_taxe = prix + part_TPS + part_TVQ

print("----------------")
print(item)
print("Prix de base: ", format(prix, ".2f"))
print("TPS (", format(TPS, ".2%"), "): ", format(part_TPS, ".2f"))
print("TVQ (", format(TVQ, ".2%"), "): ", format(part_TVQ, ".2f"))
print("================")
print(format(prix_taxe, ".2f"), "$")

