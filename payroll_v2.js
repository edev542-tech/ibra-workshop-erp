/* ═══════════════════════════════════════════════════════════════
   IBRA Soft Workshop ERP — الرواتب (v4 مع دعم اليومية) - مصحح
   ═══════════════════════════════════════════════════════════════ */

const Payroll = {
  currentMonth: new Date().toISOString().slice(0, 7),

  render() {
    const content = document.getElementById('content');
    const employees = DB.get('employees') || [];
    const payrolls = DB.get('payrolls') || [];

    const currentPayrolls = payrolls.filter(p => p.month === this.currentMonth);
    const totalSalaries = currentPayrolls.reduce((sum, p) => sum + (Number(p.netSalary) || 0), 0);
    const paidCount = currentPayrolls.filter(p => p.status === 'paid').length;
    const pendingCount = currentPayrolls.filter(p => p.status !== 'paid').length;

    let html = `
      <div class="page-header">
        <h1 class="page-title">رواتب الموظفين</h1>
        <button class="btn btn-ghost" onclick="Employees.render()">← رجوع للموظفين</button>
      </div>

      <div class="pay-hero">
        <div class="pay-hero-title">
          <h2>الرواتب 💰</h2>
          <p>إدارة وتوزيع رواتب الشهر واليوميات</p>
        </div>
        <div class="pay-hero-stats">
          <div class="phs-item">
            <div class="phs-label">إجمالي الرواتب</div>
            <div class="phs-value">${Utils.money(totalSalaries)}</div>
          </div>
          <div class="phs-item">
            <div class="phs-label">تم الدفع</div>
            <div class="phs-value" style="color:#4ade80;">${paidCount}</div>
          </div>
          <div class="phs-item">
            <div class="phs-label">قيد الانتظار</div>
            <div class="phs-value" style="color:#fbbf24;">${pendingCount}</div>
          </div>
        </div>
      </div>

      <!-- شريط التحكم الشهري واليومي -->
      <div class="card" style="padding:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
        <div>
          <label style="font-size:12px; font-weight:600; color:var(--text-muted);">الشهر:</label>
          <input type="month" value="${this.currentMonth}" 
            onchange="Payroll.currentMonth = this.value; Payroll.render();"
            style="padding:8px; border:1px solid var(--border); border-radius:6px; margin-right:8px; font-family:inherit;">
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button class="btn btn-ghost" style="background:#fef3c7; color:#92400e; border-color:#fcd34d; font-weight:700;" onclick="Payroll.openDailyForm()">
            📆 توليد راتب يوم
          </button>
          <button class="btn btn-primary" onclick="Payroll.generateAll()">⚡ توليد رواتب الشهر</button>
        </div>
      </div>

      <div class="card" style="padding:0; overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:13px; min-width:600px;">
          <thead style="background:var(--bg); color:var(--text-muted);">
            <tr>
              <th style="padding:12px; text-align:right;">الموظف</th>
              <th style="padding:12px; text-align:right;">الأساسي</th>
              <th style="padding:12px; text-align:right;">المكافآت</th>
              <th style="padding:12px; text-align:right;">الخصومات</th>
              <th style="padding:12px; text-align:right;">الصافي</th>
              <th style="padding:12px; text-align:center;">الحالة</th>
              <th style="padding:12px; text-align:center;">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            ${employees.filter(e => e.status === 'active').map(emp => {
              const pr = currentPayrolls.find(p => p.employeeId === emp.id);
              if (!pr) {
                return `
                  <tr style="border-bottom:1px solid var(--border);">
                    <td style="padding:12px; font-weight:700;">${Utils.esc(emp.name)}</td>
                    <td colspan="5" style="padding:12px; color:var(--text-muted); font-size:12px;">
                      ${emp.salaryType === 'daily' ? `📆 يومية (${Utils.money(emp.dailyRate)})` : `📅 شهري (${Utils.money(emp.salary)})`}
                      — لم يُولد راتب هذا الشهر
                    </td>
                    <td style="padding:12px; text-align:center;">
                      <button class="btn btn-ghost" style="font-size:11px;" onclick="Payroll.generateFor('${emp.id}')">➕ توليد</button>
                    </td>
                  </tr>
                `;
              }
              return `
                <tr style="border-bottom:1px solid var(--border);">
                  <td style="padding:12px; font-weight:700;">
                    ${Utils.esc(emp.name)}
                    <div style="font-size:10px; color:var(--text-muted); font-weight:400;">
                      ${pr.salaryType === 'daily' ? '📆 يومي' : '📅 شهري'}
                    </div>
                  </td>
                  <td style="padding:12px;">
                    ${pr.salaryType === 'daily' 
                      ? `${pr.attendanceDays} يوم × ${Utils.money(pr.dailyRate)}` 
                      : Utils.money(pr.baseSalary)}
                  </td>
                  <td style="padding:12px; color:var(--success);">+${Utils.money(pr.bonuses || 0)}</td>
                  <td style="padding:12px; color:var(--danger);">-${Utils.money(pr.deductions || 0)}</td>
                  <td style="padding:12px; font-weight:800;">${Utils.money(pr.netSalary)}</td>
                  <td style="padding:12px; text-align:center;">
                    <span style="background:var(--${pr.status === 'paid' ? 'success' : 'warning'}); color:#fff; padding:3px 8px; border-radius:10px; font-size:11px;">
                      ${pr.status === 'paid' ? 'مدفوع' : 'معلق'}
                    </span>
                  </td>
                  <td style="padding:12px; text-align:center;">
                    <div style="display:flex; gap:4px; justify-content:center;">
                      ${pr.status !== 'paid' ? `<button class="btn btn-success" style="padding:4px 8px; font-size:11px;" onclick="Payroll.pay('${pr.id}')">💵 دفع</button>` : ''}
                      <button class="btn btn-primary" style="padding:4px 8px; font-size:11px;" onclick="Payroll.print('${pr.id}')">🖨️</button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    content.innerHTML = html;
    this.injectStyles();
  },

  openDailyForm() {
    const employees = DB.get('employees').filter(e => e.status === 'active' && e.salaryType === 'daily');
    if (!employees.length) {
      UI.toast('⚠️ لا يوجد موظفون بنظام اليومية', 'warning');
      return;
    }

    const bodyHtml = `
      <div style="display:grid; gap:14px;">
        <div>
          <label style="font-size:12px; font-weight:600; color:var(--text-muted);">الموظف</label>
          <select id="dailyEmpId" style="width:100%; padding:10px; border:1px solid var(--border); border-radius:8px; margin-top:4px;">
            ${employees.map(e => `<option value="${e.id}" data-rate="${e.dailyRate}">${e.name} (${Utils.money(e.dailyRate)}/يوم)</option>`).join('')}
          </select>
        </div>
        <div>
          <label style="font-size:12px; font-weight:600; color:var(--text-muted);">التاريخ</label>
          <input type="date" id="dailyDate" value="${Utils.today()}" 
            style="width:100%; padding:10px; border:1px solid var(--border); border-radius:8px; margin-top:4px;">
        </div>
        <div>
          <label style="font-size:12px; font-weight:600; color:var(--text-muted);">عدد الأيام</label>
          <input type="number" id="dailyCount" value="1" min="1" max="31" 
            style="width:100%; padding:10px; border:1px solid var(--border); border-radius:8px; margin-top:4px; font-size:18px; font-weight:800; text-align:center;">
        </div>
        <div>
          <label style="font-size:12px; font-weight:600; color:var(--text-muted);">ملاحظات (اختياري)</label>
          <input type="text" id="dailyNote" placeholder="مثال: يوم عمل إضافي..." 
            style="width:100%; padding:10px; border:1px solid var(--border); border-radius:8px; margin-top:4px;">
        </div>
      </div>
    `;

    UI.openModal('📆 توليد راتب يوم', bodyHtml, `
      <button class="btn btn-ghost" onclick="UI.closeModal()">إلغاء</button>
      <button class="btn btn-primary" onclick="Payroll.generateDaily()">💾 توليد</button>
    `);
  },

  generateDaily() {
    const empId = document.getElementById('dailyEmpId').value;
    const date = document.getElementById('dailyDate').value;
    const count = Number(document.getElementById('dailyCount').value) || 1;
    const note = document.getElementById('dailyNote').value.trim();

    const emp = DB.find('employees', empId);
    if (!emp) return;

    const total = count * (Number(emp.dailyRate) || 0);
    const month = date.substring(0, 7);

    const newPayroll = DB.insert('payrolls', {
      employeeId: empId,
      employeeName: emp.name,
      month: month,
      date: date,
      salaryType: 'daily',
      attendanceDays: count,
      dailyRate: emp.dailyRate || 0,
      baseSalary: total,
      bonuses: 0,
      deductions: 0,
      netSalary: total,
      notes: note || `راتب يوم (${count} أيام)`,
      status: 'paid',
      paidAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    });

    DB.insert('expenses', {
      title: `راتب ${emp.name} - ${date}`,
      amount: total,
      notes: note || `راتب يوم (${count} أيام)`,
      date: new Date().toISOString()
    });

    DB.insert('vouchers', {
      number: Utils.docNumber('PV'),
      type: 'payment',
      party: 'salaries',
      partyName: emp.name,
      notes: `راتب يوم ${date}`,
      amount: total,
      currency: 'YER',
      createdAt: new Date().toISOString()
    });

    UI.closeModal();
    this.render();
    UI.toast(`✅ تم توليد راتب ${count} يوم بمبلغ ${Utils.money(total)}`, 'success');
    
    setTimeout(() => this.print(newPayroll.id), 500);
  },

  generateAll() {
    if (!confirm('هل تريد توليد رواتب جميع الموظفين لشهر ' + this.currentMonth + '؟')) return;
    const employees = DB.get('employees').filter(e => e.status === 'active');
    let count = 0;
    employees.forEach(emp => {
      if (this.generateFor(emp.id, true)) count++;
    });
    this.render();
    UI.toast(`✅ تم توليد ${count} راتب`, 'success');
  },

  generateFor(empId, silent = false) {
    const emp = DB.find('employees', empId);
    if (!emp) return false;

    const payrolls = DB.get('payrolls') || [];
    const existing = payrolls.find(p => p.employeeId === empId && p.month === this.currentMonth && !p.date);
    if (existing) return false;

    let baseSalary = 0;
    let attendanceDays = 0;
    
    if (emp.salaryType === 'daily') {
      const attendance = DB.get('attendance') || [];
      const monthAttendance = attendance.filter(a => 
        a.employeeId === empId && 
        a.date && a.date.startsWith(this.currentMonth) && 
        a.status === 'present'
      );
      attendanceDays = monthAttendance.length;
      baseSalary = attendanceDays * (Number(emp.dailyRate) || 0);
    } else {
      baseSalary = Number(emp.salary) || 0;
    }

    DB.insert('payrolls', {
      employeeId: empId,
      employeeName: emp.name,
      month: this.currentMonth,
      salaryType: emp.salaryType || 'monthly',
      attendanceDays: attendanceDays,
      dailyRate: emp.dailyRate || 0,
      baseSalary: baseSalary,
      bonuses: 0,
      deductions: 0,
      netSalary: baseSalary,
      status: 'pending',
      createdAt: new Date().toISOString()
    });

    if (!silent) {
      this.render();
      UI.toast('✅ تم توليد الراتب', 'success');
    }
    return true;
  },

  pay(id) {
    const pr = DB.find('payrolls', id);
    if (!pr) return;
    if (!confirm(`تأكيد دفع راتب ${pr.employeeName} بمبلغ ${Utils.money(pr.netSalary)}؟`)) return;

    DB.update('payrolls', id, { status: 'paid', paidAt: new Date().toISOString() });
    
    DB.insert('expenses', {
      title: `راتب ${pr.employeeName} - ${pr.month}`,
      amount: pr.netSalary,
      notes: 'راتب شهري',
      date: new Date().toISOString()
    });

    DB.insert('vouchers', {
      number: Utils.docNumber('PV'),
      type: 'payment',
      party: 'salaries',
      partyName: pr.employeeName,
      notes: `راتب شهر ${pr.month}`,
      amount: pr.netSalary,
      currency: 'YER',
      createdAt: new Date().toISOString()
    });

    this.render();
    UI.toast('✅ تم دفع الراتب وتسجيله في الخزينة', 'success');
    setTimeout(() => this.print(id), 500);
  },

  print(id) {
    const pr = DB.find('payrolls', id);
    if (!pr) return;

    const settings = DB.getSettings();
    const logo = settings.companyLogo || '';
    
    const numberToArabicWords = (num) => {
      if (num === 0) return 'صفر';
      const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
      const tens = ['', 'عشرة', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
      const hundreds = ['', 'مئة', 'مئتان', 'ثلاثمئة', 'أربعمئة', 'خمسمئة', 'ستمئة', 'سبعمئة', 'ثمانمئة', 'تسعمئة'];
      
      function convertLessThan1000(n) {
        if (n === 0) return '';
        let parts = [];
        const h = Math.floor(n / 100);
        const t = Math.floor((n % 100) / 10);
        const o = n % 10;
        if (h > 0) parts.push(hundreds[h]);
        if (t > 0 || o > 0) {
          if (o > 0 && t === 0) parts.push(ones[o]);
          else if (o === 0 && t > 0) parts.push(tens[t]);
          else parts.push(ones[o] + ' و' + tens[t]);
        }
        return parts.join(' و');
      }
      
      num = Math.floor(num);
      if (num === 0) return 'صفر';
      let result = [];
      const millions = Math.floor(num / 1000000);
      const thousands = Math.floor((num % 1000000) / 1000);
      const remainder = num % 1000;
      if (millions > 0) result.push(convertLessThan1000(millions) + ' مليون');
      if (thousands > 0) result.push(convertLessThan1000(thousands) + ' ألف');
      if (remainder > 0) result.push(convertLessThan1000(remainder));
      return result.join(' و');
    };

    const win = window.open('', '_blank');
    
    const html = `
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>إيصال راتب - ${pr.employeeName}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
            background: #f5f5f5;
            padding: 20px;
            direction: rtl;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          .receipt {
            background: #ffffff;
            max-width: 500px;
            margin: 0 auto;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 8px 30px rgba(0,0,0,0.15);
          }
          
          .r-header {
            background: linear-gradient(135deg, #ea580c 0%, #d97706 100%);
            color: #ffffff;
            padding: 28px 24px;
            text-align: center;
            position: relative;
            overflow: hidden;
          }
          .r-header::before {
            content: '';
            position: absolute;
            top: -50px;
            right: -50px;
            width: 180px;
            height: 180px;
            background: radial-gradient(circle, rgba(255,255,255,0.2), transparent 70%);
            border-radius: 50%;
          }
          .r-logo {
            width: 60px;
            height: 60px;
            object-fit: contain;
            margin: 0 auto 10px;
            position: relative;
            z-index: 1;
          }
          .r-company {
            font-size: 14px;
            font-weight: 700;
            opacity: 0.95;
            margin-bottom: 4px;
            position: relative;
            z-index: 1;
          }
          .r-title {
            font-size: 24px;
            font-weight: 900;
            position: relative;
            z-index: 1;
          }
          .r-subtitle {
            font-size: 12px;
            opacity: 0.9;
            margin-top: 6px;
            position: relative;
            z-index: 1;
          }
          .r-badge {
            display: inline-block;
            margin-top: 10px;
            padding: 4px 14px;
            background: rgba(255,255,255,0.25);
            border-radius: 20px;
            font-size: 11px;
            font-weight: 700;
            position: relative;
            z-index: 1;
          }
          
          .r-body { padding: 24px; }
          
          .r-section {
            background: #fff7ed;
            border-radius: 12px;
            padding: 14px 16px;
            margin-bottom: 16px;
            border: 1px solid #fed7aa;
          }
          .r-section-title {
            font-size: 12px;
            font-weight: 800;
            color: #92400e;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            gap: 6px;
          }
          
          .r-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            font-size: 13px;
            border-bottom: 1px dashed #fed7aa;
          }
          .r-row:last-child { border-bottom: none; }
          .r-label { color: #78716c; font-weight: 500; }
          .r-value { font-weight: 700; color: #1e293b; }
          .r-value.highlight { color: #ea580c; }
          
          .r-amount-box {
            background: linear-gradient(135deg, #ea580c 0%, #d97706 100%);
            color: #ffffff;
            padding: 20px;
            border-radius: 12px;
            text-align: center;
            margin: 16px 0;
            box-shadow: 0 4px 15px rgba(234,88,12,0.3);
          }
          .r-amount-label {
            font-size: 12px;
            font-weight: 600;
            opacity: 0.95;
            margin-bottom: 6px;
          }
          .r-amount-value {
            font-size: 32px;
            font-weight: 900;
            letter-spacing: -1px;
          }
          .r-amount-words {
            font-size: 11px;
            opacity: 0.95;
            margin-top: 6px;
            padding-top: 8px;
            border-top: 1px dashed rgba(255,255,255,0.3);
            font-weight: 500;
          }
          
          .r-signatures {
            display: flex;
            justify-content: space-between;
            margin-top: 30px;
            padding-top: 16px;
            border-top: 1px dashed #e2e8f0;
          }
          .signature-box { text-align: center; flex: 1; }
          .sig-line {
            height: 45px;
            border-bottom: 2px solid #cbd5e1;
            margin: 0 15px;
          }
          .sig-label {
            font-size: 11px;
            color: #64748b;
            margin-top: 8px;
            font-weight: 600;
          }
          
          .r-footer {
            background: #fef3c7;
            padding: 14px;
            text-align: center;
            font-size: 10px;
            color: #92400e;
            line-height: 1.8;
          }
          .r-footer-brand { font-weight: 800; font-size: 11px; }
          
          .print-actions {
            position: fixed;
            top: 15px;
            left: 15px;
            display: flex;
            gap: 8px;
            z-index: 999;
          }
          .print-btn {
            padding: 10px 20px;
            border-radius: 10px;
            border: none;
            font-family: inherit;
            font-size: 13px;
            font-weight: 700;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          }
          .btn-print {
            background: linear-gradient(135deg, #ea580c, #d97706);
            color: #ffffff;
          }
          .btn-close {
            background: #ffffff;
            color: #333;
            border: 1px solid #ddd;
          }
          
          @media print {
            body {
              background: #ffffff;
              padding: 0;
            }
            .receipt {
              box-shadow: none;
              border-radius: 0;
              max-width: 100%;
            }
            .print-actions {
              display: none;
            }
          }
        </style>
      </head>
      <body>
        <div class="print-actions">
          <button class="btn-print print-btn" onclick="window.print()">🖨️ طباعة</button>
          <button class="btn-close print-btn" onclick="window.close()">✖ إغلاق</button>
        </div>
        
        <div class="receipt">
          <div class="r-header">
            ${logo ? `<img src="${logo}" class="r-logo" alt="Logo">` : ''}
            <div class="r-company">${settings.companyName || 'ورشة التصنيع'}</div>
            <div class="r-title">إيصال راتب</div>
            <div class="r-subtitle">${pr.date ? `راتب يوم ${Utils.date(pr.date)}` : `راتب شهر ${pr.month}`}</div>
            <div class="r-badge">
              ${pr.status === 'paid' ? '✅ مدفوع' : '⏳ معلق'}
            </div>
          </div>
          
          <div class="r-body">
            <div class="r-section">
              <div class="r-section-title">👤 بيانات الموظف</div>
              <div class="r-row">
                <span class="r-label">اسم الموظف:</span>
                <span class="r-value">${Utils.esc(pr.employeeName)}</span>
              </div>
              <div class="r-row">
                <span class="r-label">التاريخ/الشهر:</span>
                <span class="r-value">${pr.date ? Utils.date(pr.date) : pr.month}</span>
              </div>
              <div class="r-row">
                <span class="r-label">نوع الأجر:</span>
                <span class="r-value highlight">${pr.salaryType === 'daily' ? '📆 يومي (اليومية)' : '📅 شهري'}</span>
              </div>
              ${pr.salaryType === 'daily' ? `
                <div class="r-row">
                  <span class="r-label">عدد الأيام:</span>
                  <span class="r-value">${pr.attendanceDays} يوم</span>
                </div>
                <div class="r-row">
                  <span class="r-label">قيمة اليومية:</span>
                  <span class="r-value">${Utils.money(pr.dailyRate)}</span>
                </div>
              ` : ''}
            </div>
            
            <div class="r-section">
              <div class="r-section-title">💰 تفاصيل الراتب</div>
              <div class="r-row">
                <span class="r-label">الراتب الأساسي:</span>
                <span class="r-value">${Utils.money(pr.baseSalary)}</span>
              </div>
              ${pr.bonuses > 0 ? `
                <div class="r-row">
                  <span class="r-label">المكافآت والبدلات:</span>
                  <span class="r-value" style="color:#16a34a;">+ ${Utils.money(pr.bonuses)}</span>
                </div>
              ` : ''}
              ${pr.deductions > 0 ? `
                <div class="r-row">
                  <span class="r-label">الخصومات:</span>
                  <span class="r-value" style="color:#dc2626;">- ${Utils.money(pr.deductions)}</span>
                </div>
              ` : ''}
            </div>
            
            <div class="r-amount-box">
              <div class="r-amount-label">صافي الراتب المستحق</div>
              <div class="r-amount-value">${Utils.money(pr.netSalary)}</div>
              <div class="r-amount-words">${numberToArabicWords(pr.netSalary)} ريال يمني فقط</div>
            </div>
            
            <div class="r-signatures">
              <div class="signature-box">
                <div class="sig-line"></div>
                <div class="sig-label">توقيع الموظف</div>
              </div>
              <div class="signature-box">
                <div class="sig-line"></div>
                <div class="sig-label">توقيع الإدارة</div>
              </div>
            </div>
          </div>
          
          <div class="r-footer">
            <div class="r-footer-brand">${settings.companyName || 'ورشة التصنيع'}</div>
            <div>📞 ${settings.companyPhone || ''}</div>
            <div style="margin-top:4px; font-size:9px;">تم إصداره بواسطة IBRA Soft ERP</div>
          </div>
        </div>
      </body>
      </html>
    `;
    
    win.document.open();
    win.document.write(html);
    win.document.close();
  },

  injectStyles() {
    if (document.getElementById('pay-styles-v3')) return;
    const style = document.createElement('style');
    style.id = 'pay-styles-v3';
    style.innerHTML = `
      .pay-hero {
        background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%);
        border-radius: 24px; padding: 22px; color: #fff;
        margin-bottom: 16px; box-shadow: 0 10px 30px rgba(245,158,11,0.3);
        position: relative; overflow: hidden;
      }
      .pay-hero::before {
        content: ''; position: absolute;
        top: -50px; right: -50px; width: 250px; height: 250px;
        background: radial-gradient(circle, rgba(255,255,255,0.15), transparent 70%);
        border-radius: 50%;
      }
      .pay-hero-title { margin-bottom: 16px; position: relative; z-index: 1; }
      .pay-hero-title h2 { font-size: 22px; font-weight: 800; margin: 0 0 4px; }
      .pay-hero-title p { font-size: 13px; opacity: 0.9; }
      .pay-hero-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; position: relative; z-index: 1; }
      .phs-item { background: rgba(255,255,255,0.15); backdrop-filter: blur(10px); padding: 12px; border-radius: 12px; }
      .phs-label { font-size: 10px; opacity: 0.9; }
      .phs-value { font-size: 18px; font-weight: 800; margin-top: 2px; }
    `;
    document.head.appendChild(style);
  }
};

console.log('✅ Payroll v4 loaded');