note = int(input("Donne moi ta note: "))

# palier 1 : 80 - 100 => 3 etoiles
if note >= 80:
    print("3 etoiles")
elif note >= 60:
    print("2 etoiles")
else:
    print("1 etoile")
