print("Menu")
print("1) Option 1")
print("2) Option 2")
print("3) Option 3")

choix = input("Choisi une option dans le menu: ")

##if choix == "1":
##    print("Tu as choisi l'option 1")
##elif choix == "2":
##    print("Tu as choisi l'option 2")
##elif choix == "3":
##    print("Tu as choisi l'option 3")
##else:
##    print("Cette option n'est pas supportée")


# Alternative

match choix:
    case "1":
        print("Tu as choisi l'option 1")
    case "2":
        print("Tu as choisi l'option 2")
    case "3":
        print("Tu as choisi l'option 3")
    case _:
        print("Cette option n'est pas supportée")
