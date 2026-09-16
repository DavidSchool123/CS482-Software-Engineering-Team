print("Hello World")

# get the inputs from the users
noOFItems = int(input("Enter the number of items: "))
costOfItems = float(input("Enter the cost of items: "))
stateCode = str(input("Enter the state code: "))


totalCost = noOFItems * costOfItems # overall cost

print(f"The state code is {stateCode}")

print(f"{noOFItems} items cost ${costOfItems} each, for ${totalCost} total.")

# determine the discount
if (totalCost >= 50000):
    discount = 0.15
elif (totalCost >= 10000):
    discount = 0.10
elif (totalCost >= 7000):
    discount = 0.07
elif (totalCost >= 5000):
    discount = 0.05
elif (totalCost >= 1000):
    discount = 0.03
else :
    discount = 0

totalCost = totalCost - (totalCost*discount) # added discount to overall cost

print(f"cost with discount is ${totalCost}")

# determine the tax addition
stateTax = 0.0

if stateCode == 'UT':
    stateTax = 0.0685
elif stateCode == 'NV':
    stateTax = 0.08
elif stateCode == 'TX':
    stateTax = 0.0625
elif stateCode == 'AL':
    stateTax = 0.04
elif stateCode == 'CA':
    stateTax = 0.0825
else:
    print('Invalid State Code')

totalCost = totalCost + (totalCost*stateTax) # compute final cost

print(f"The final cost = ${totalCost}")
