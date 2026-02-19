# 1. Recuperer les notes et converti les notes en nombre
projet_1 = int(input("Note projet 1: "))
projet_2 = int(input("Note projet 2: "))
intra = int(input("Note intra: "))
final = int(input("Note final: "))

# 3. Calculer la moyenne
moyenne =  projet_1 * 0.15 + projet_2 * 0.15 + intra * 0.35 + final * 0.35

# 4. Comparer la moyenne a l'echelle de notation
#    et afficher l'appreciation de la moyenne

print("Moyenne:", moyenne)
if moyenne >= 90:
    print("Excellent")
elif moyenne >= 80:
    print("Tres bien")
elif moyenne >= 70:
    print("Bien")
elif moyenne >= 60:
    print("Passable")
else:
    print("Echec")
