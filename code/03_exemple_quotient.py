# 1. 

# Demander le prenom
prenom =  input("Prenom: ")

# Demander le nom
nom  = input("Nom: ")

# Demander l'age
age = input("Age: ")
age_conv = int(age)

# Verifier si age >= 18

if age_conv >= 18:  # Si oui
    print("Majeur")
else:               # Sinon (age < 18)
    print("Mineur")
