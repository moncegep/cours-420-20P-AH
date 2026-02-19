prix_item = float(input("Prix de l'article : "))
montant_paye = float(input("Montant payé : "))

retour = round((montant_paye - prix_item) * 100)  # en cents

if retour < 0:
    print("Argent insuffisant 😅 Il manque", format(-retour / 100, ".2f"), "$")

elif retour == 0:
    print("Argent exact 👌")

else:
    icon = "💵" if retour < 2000 else "💰"
    print("Argent en trop", icon, ". Il faut rendre au client",format(retour / 100, ".2f"), "$")
    
    print("Retrait de la caisse")
    print("-" * 20, "\n")
    dollars = retour // 100
    cents = retour % 100

    nb_20 = dollars // 20
    dollars = dollars % 20

    nb_10 = dollars // 10
    dollars = dollars % 10

    nb_5 = dollars // 5
    dollars = dollars % 5

    nb_2 = dollars // 2
    dollars = dollars % 2

    nb_1 = dollars

    nb_25c = cents // 25
    cents = cents % 25

    nb_10c = cents // 10
    cents = cents % 10

    nb_5c = cents // 5
    cents = cents % 5

    nb_1c = cents

    if nb_20 > 0: print("20$ :", nb_20)
    if nb_10 > 0: print("10$ :", nb_10)
    if nb_5 > 0: print("5$  :", nb_5)
    if nb_2 > 0: print("2$  :", nb_2)
    if nb_1 > 0: print("1$  :", nb_1)
    if nb_25c > 0: print("25¢ :", nb_25c)
    if nb_10c > 0: print("10¢ :", nb_10c)
    if nb_5c > 0: print("5¢  :", nb_5c)
    if nb_1c > 0: print("1¢  :", nb_1c)
