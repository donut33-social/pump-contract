from sympy import symbols, Eq, solve, exp
from scipy.integrate import quad
import numpy as np
import matplotlib.pyplot as plt
import math

# 定义变量
a, x = symbols('a x', real=True)

# 定义方程 y = a - b / (x + 5 * 10^26)
y = 1_400_000_000 * exp(x / a)

# 条件 1：x = 0 时，y = 1.5e9
# condition1 = Eq(y.subs(x, 0), 1_400_000_000)

# 条件 2：x = 7e26 时，y = 2e10
condition2 = Eq(y.subs(x, 6.5 * 10**26), 20_000_000_000)

# 解方程组
solutions = solve([condition2], (a))

print(solutions)
# a = solutions[1]
# b = solutions[1]

b = 2.4442889787856833e26

# #  1400000000    0.0000000014
# #  20 000 000 000    0.000000020
# {a: 9/280000000000000000, b: -12000000000/7}

# Define the function y = 177000000000/7 - 33300000000000000000000000000000000000/7/(x + 2 * 10^26)y = 177000000000/7 - 33300000000000000000000000000000000000/7/(x + 2 * 10^26)
def y_function(x):
    return 1_400_000_000 * math.exp(x / 2.4442889787856833e26)

integral_result, error = quad(y_function, 0, 10**24)

print(f"100万代币结果需要: {integral_result / 10**36}")

integral_result, error = quad(y_function, 0, 2 * 10**24)

print(f"200万代币结果需要: {integral_result / 10**36}")

integral_result, error = quad(y_function, 0, 5 * 10**24)

print(f"500万代币结果需要: {integral_result / 10**36}")

integral_result, error = quad(y_function, 0, 1 * 10**25)

print(f"1000万代币结果需要: {integral_result / 10**36}")

integral_result, error = quad(y_function, 0, 2 * 10**25)

print(f"2000万代币结果需要: {integral_result / 10**36}")

integral_result, error = quad(y_function, 0, 1 * 10**26)

print(f"1亿代币需要: {integral_result / 10**36}")

integral_result, error = quad(y_function, 0, 2 * 10**26)

print(f"2亿代币需要: {integral_result / 10**36}")

integral_result, error = quad(y_function, 0, 6.5 * 10**26)

print(f"6.5亿代币需要: {integral_result / 10**36}")

# Generate x values from 0 to 7e26
x_values = np.linspace(0, 6.5 * 10**26, 500)

# Generate y values
y_values = []
for a in x_values:
    y_values.append(y_function(a))
# y_values = y_function(x_values)

# Plot the function
plt.figure(figsize=(12, 6))
plt.plot(x_values, y_values, label=r'$y = 1.4 \times 10^9 \times e^{\frac{x}{2.4442889787856833 \times 10^{26}}}$', color='b')
plt.xlabel('x')
plt.ylabel('y')
plt.grid(True)
plt.legend()
plt.show()