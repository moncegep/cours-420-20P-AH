action = input("Choisis : 🪨 📄 ✂ : ")

match action:
    case "🪨":
        print("Roche !")
    case "📄":
        print("Papier !")
    case "✂️":
        print("Ciseaux !")
    case _:
        print("Choix invalide 😅")
