// services/goal_service.js — цели накопления. Flutter → services/goal_service.dart
// Part 3: progress = saved/target*100; completed если saved>=target.
window.AF = window.AF || {}; AF.Services = AF.Services || {};
AF.Services.Goal = {
  progress(goal) {
    if (!goal.targetAmount) return 0;
    return Math.min(100, goal.savedAmount / goal.targetAmount * 100);
  },
  status(goal) {
    if (goal.savedAmount >= goal.targetAmount) return 'completed';
    return goal.status || 'active';
  },
  // Прогноз даты достижения по средней скорости накопления (₽/мес)
  forecastDate(goal, monthlyContribution) {
    const left = goal.targetAmount - goal.savedAmount;
    if (left <= 0) return new Date();
    if (!monthlyContribution || monthlyContribution <= 0) return null;
    const months = Math.ceil(left / monthlyContribution);
    const d = new Date(); d.setMonth(d.getMonth() + months);
    return d;
  },
};
