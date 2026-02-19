commande = input("Commande envoyé au robot: ")

# Resolution avec if-else

if commande == "FW" or commande == "fw":
    print("Le robot avance")
elif commande == "BW" or commande == "bw":
    print("Le robot recule")
elif commande == "LT" or commande == "lt":
    print("Le robot tourne a gauche")
elif commande == "RT" or commande == "rt":
    print("Le robot tourne a droite")
elif commande == "STOP" or commande == "stop":
    print("Le robot s'arrête")
else:
    print("Commande invalide")

# Resolution match-case

match commande:
    case "FW" | "fw":
        print("Le robot avance")
    case "BW" | "bw":
        print("Le robot recule")
    case "LT" | "lt":
        print("Le robot tourne a gauche")
    case "RT" | "rt":
        print("Le robot tourne a droite")
    case "STOP" | "stop":
        print("Le robot s'arrête")
    case _:
        print("Commande invalide")
        
        
