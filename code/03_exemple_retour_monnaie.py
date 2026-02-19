# 1. Demander a l'utilisateur le montant d'achat (et le convertir en float)
montant = float(input("Montant d'achat: "))

# 2. Comparer le montant au palier pour determiner le rabais à appliquer


# SI montant < 50 => rabais = 0
if montant < 50:
    rabais = 0
elif montant < 100:
    rabais = 0.10
elif montant < 200:
    rabais  = 0.15
else:
    rabais = 0.20


print("=== FACTURE AVEC RABAIS ===")
print("Montant d'achat ($):", montant, "\n")
print("Sous-total:", format(montant, ".2f"), "$")

if montant < 50:
    print("Aucun rabais applicable")
else:
    print("Rabais (" + format(rabais, ".0%") + ")", format(rabais * montant, ".2f"), "$")
    
print("Total à payer:", format(montant - (montant * rabais), ".2f"), "$")
