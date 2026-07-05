
        const { useState, useEffect, useMemo, useCallback } = React;
        dayjs.locale('ar');
        const {
            Layout, Menu, Button, Card, Table, Tag, Space,
            Typography, Statistic, Row, Col, Modal, Form,
            Input, InputNumber, Select, message, Spin,
            ConfigProvider, theme, Result, Drawer, Descriptions, Collapse,
            Divider, Empty, Tooltip, Dropdown, Avatar, Checkbox, Popconfirm, DatePicker, Radio
        } = antd;

        // Safe icon loader - creates a placeholder if an icon doesn't exist
        const _icons = window.icons || window.AntDesignIcons || {};
        const safeIcon = (name) => _icons[name] || (() => React.createElement('span', { role: 'img', 'aria-label': name, style: { display: 'inline-block', width: '1em', height: '1em' } }, '●'));
        const DashboardOutlined = safeIcon('DashboardOutlined');
        const HomeOutlined = safeIcon('HomeOutlined');
        const TeamOutlined = safeIcon('TeamOutlined');
        const FileTextOutlined = safeIcon('FileTextOutlined');
        const LogoutOutlined = safeIcon('LogoutOutlined');
        const PlusOutlined = safeIcon('PlusOutlined');
        const EditOutlined = safeIcon('EditOutlined');
        const DeleteOutlined = safeIcon('DeleteOutlined');
        const EnvironmentOutlined = safeIcon('EnvironmentOutlined');
        const ArrowUpOutlined = safeIcon('ArrowUpOutlined');
        const ArrowDownOutlined = safeIcon('ArrowDownOutlined');
        const UserOutlined = safeIcon('UserOutlined');
        const GlobalOutlined = safeIcon('GlobalOutlined');
        const BankOutlined = safeIcon('BankOutlined');
        const DollarOutlined = safeIcon('DollarOutlined');
        const SearchOutlined = safeIcon('SearchOutlined');
        const LockOutlined = safeIcon('LockOutlined');
        const InboxOutlined = safeIcon('InboxOutlined');
        const WalletOutlined = safeIcon('WalletOutlined');
        const ReloadOutlined = safeIcon('ReloadOutlined');

        const { Header, Content, Sider, Footer } = Layout;
        const { Title, Text } = Typography;

        // Error Boundary to catch render errors
        class ErrorBoundary extends React.Component {
            constructor(props) { super(props); this.state = { hasError: false, error: null }; }
            static getDerivedStateFromError(error) { return { hasError: true, error }; }
            componentDidCatch(error, info) { console.error('React Error Boundary:', error, info); }
            render() {
                if (this.state.hasError) {
                    return React.createElement('div', { style: { padding: 40, textAlign: 'center', fontFamily: 'Cairo, sans-serif', direction: 'rtl' } },
                        React.createElement('h2', { style: { color: '#c00' } }, '⚠️ حدث خطأ في التطبيق'),
                        React.createElement('pre', { style: { background: '#fff3f3', padding: 20, borderRadius: 8, textAlign: 'left', direction: 'ltr', overflow: 'auto' } }, this.state.error?.toString()),
                        React.createElement('button', { onClick: () => window.location.reload(), style: { padding: '10px 20px', fontSize: 16, cursor: 'pointer', marginTop: 20 } }, 'إعادة تحميل الصفحة')
                    );
                }
                return this.props.children;
            }
        }

        // --- Configuration ---
        const SUPABASE_URL = "https://hifpzldubwoetexqjnau.supabase.co";
        const SUPABASE_KEY = "sb_publishable_LED-vbACqUUvZ6tm1aUDtQ_I2F_iMQX";
        const libSupabase = window.supabase;
        
        // Safe storage check to support local file:// protocol
        const getSafeStorage = () => {
            try {
                const testKey = '__storage_test__';
                window.localStorage.setItem(testKey, testKey);
                window.localStorage.removeItem(testKey);
                return window.localStorage;
            } catch (e) {
                const memStorage = {};
                return {
                    getItem: (key) => memStorage[key] || null,
                    setItem: (key, value) => { memStorage[key] = String(value); },
                    removeItem: (key) => { delete memStorage[key]; }
                };
            }
        };

        const supabase = libSupabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
            auth: {
                storage: getSafeStorage(),
                persistSession: true
            }
        });

        const SUPER_ADMIN_EMAIL = "khalednasr007@gmail.com";

        // --- Utils ---
        const sarFormatter = (val) => {
            return new Intl.NumberFormat('ar-SA', {
                style: 'currency',
                currency: 'SAR',
            }).format(val);
        };

        const logActivity = async (actionType, targetModule, recordId, description) => {
            try {
                const sessionRes = await supabase.auth.getSession();
                const session = sessionRes.data?.session;
                const user = session?.user;
                if (!user) return;

                const logData = {
                    user_id: user.id,
                    user_email: user.email,
                    action_type: actionType,
                    target_module: targetModule,
                    record_id: recordId ? String(recordId) : null,
                    description: description
                };

                const { error } = await supabase
                    .from('system_logs')
                    .insert([logData]);

                if (error) {
                    console.warn("Failed to write system_logs (resilient fallback): ", error.message);
                }
            } catch (e) {
                console.warn("Activity logging failed: ", e);
            }
        };

        // --- Building-Level RBAC Helpers ---
        const isAssignedBuilding = (profile, buildingId) => {
            if (!profile) return false;
            if (profile.role === 'admin') return true;
            return (profile.assigned_buildings || []).includes(buildingId);
        };

        const getAssignedBuildingIds = (profile) => {
            if (!profile) return [];
            if (profile.role === 'admin') return null; // null = no filter (all buildings)
            return profile.assigned_buildings || [];
        };

        const filterByAssignedBuildings = (items, profile, buildingIdKey = 'building_id') => {
            const assignedIds = getAssignedBuildingIds(profile);
            if (assignedIds === null) return items; // admin sees all
            return items.filter(item => assignedIds.includes(item[buildingIdKey]));
        };

        const processUsername = (u) => {
            if (!u) return u;
            return u.includes('@') ? u.toLowerCase() : `${u.toLowerCase()}@portal.local`;
        };

        const displayUsername = (u) => {
            if (!u) return u;
            return u.endsWith('@portal.local') ? u.replace('@portal.local', '') : u;
        };

        // Hijri Utilities
        const toHijri = (dateVal) => {
            if (!dateVal) return '';
            const d = new Date(dateVal);
            if (isNaN(d.getTime())) return '';
            try {
                return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                }).format(d);
            } catch (e) {
                return '';
            }
        };

        const toHijriShort = (dateVal) => {
            if (!dateVal) return '';
            const d = new Date(dateVal);
            if (isNaN(d.getTime())) return '';
            try {
                return new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                }).format(d);
            } catch (e) {
                return '';
            }
        };

        const getHijriYear = (dateVal = new Date()) => {
            const d = new Date(dateVal);
            try {
                const formatted = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', { year: 'numeric' }).format(d);
                const match = formatted.match(/(\d+)/);
                return match ? parseInt(match[1], 10) : 1447;
            } catch (e) {
                return 1447;
            }
        };

        const getGregorianRangeForHijriMonth = (year, monthIndex) => {
            let startDate = null;
            let endDate = null;
            const refHijri = 1447;
            const refGregorian = new Date(2025, 5, 26); // June 26, 2025 is 1 Muharram 1447
            const daysOffset = (year - refHijri) * 354.367;
            const approxStart = new Date(refGregorian.getTime() + daysOffset * 24 * 60 * 60 * 1000);
            const searchStart = new Date(approxStart.getTime() - 60 * 24 * 60 * 60 * 1000);
            
            for (let d = 0; d                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                {
            const currentHijriYear = getHijriYear(new Date());
            const { data, error } = await supabase
                .from('receipts')
                .select('receipt_number')
                .like('receipt_number', `${currentHijriYear}-%`)
                .order('receipt_number', { ascending: false })
                .limit(1);

            if (error) {
                console.error("Error generating receipt number:", error);
                return `${currentHijriYear}-${String(Date.now()).slice(-5)}`;
            }

            let nextNum = 1;
            if (data && data.length > 0) {
                const lastNumStr = data[0].receipt_number.split('-')[1];
                const lastNum = parseInt(lastNumStr, 10);
                if (!isNaN(lastNum)) {
                    nextNum = lastNum + 1;
                }
            }

            const paddedNum = String(nextNum).padStart(5, '0');
            return `${currentHijriYear}-${paddedNum}`;
        };

        const generateExpenseVoucherNumber = async () => {
            const currentHijriYear = getHijriYear(new Date());
            const { data, error } = await supabase
                .from('vouchers_expense')
                .select('voucher_number')
                .like('voucher_number', `EXP-${currentHijriYear}-%`)
                .order('voucher_number', { ascending: false })
                .limit(1);

            if (error) {
                console.error("Error generating expense voucher number:", error);
                return `EXP-${currentHijriYear}-${String(Date.now()).slice(-5)}`;
            }

            let nextNum = 1;
            if (data && data.length > 0) {
                const lastNumStr = data[0].voucher_number.split('-')[2];
                const lastNum = parseInt(lastNumStr, 10);
                if (!isNaN(lastNum)) {
                    nextNum = lastNum + 1;
                }
            }

            const paddedNum = String(nextNum).padStart(5, '0');
            return `EXP-${currentHijriYear}-${paddedNum}`;
        };



        // --- Components ---

        const ReceiptModal = ({ receipt, visible, onClose }) => {
            if (!receipt) return null;

            const handlePrint = () => {
                window.print();
            };

            return (
                                                                                                                                                                                                                  إغلاق         ,
                                                                                                    🖨️       } onClick={handlePrint} className="bg-primary hover:bg-opacity-90 no-print">طباعة السند / حفظ PDF         
                    ]}
                    width={750}
                    bodyStyle={{ padding: 0 }}
                >
                                                               
                                                                            
                                                               سند قبض      
                            
                            {/* Header Band */}
                                                                                                   
                                     
                                                                                                              
                                                         سند قبض إلكتروني
                                         
                                                                                      بوابة تحصيل الإيجارات السعودية    
                                      
                                                                                         
                                                                       رقم السند: {receipt.receipt_number}      
                                                                                   
                                        التاريخ: {receipt.created_at ? dayjs(receipt.created_at).format('YYYY-MM-DD م') : ''}
                                        {receipt.created_at ? ` | ${toHijriShort(receipt.created_at)} هـ` : ''}
                                          
                                      
                                  

                            {/* Body */}
                                                                         
                                {/* Row 1: Tenant & Property */}
                                                       
                                                   
                                                                                                                            
                                                                                  
                                                                                 {receipt.tenant_name || '-'}                    
                                                                                      {receipt.id_number || '-'}                    
                                                                                      {receipt.phone_number || '-'}                    
                                                           
                                               
                                          
                                                   
                                                                                                                                 
                                                                                  
                                                                                  {receipt.building_name || '-'}                    
                                                                                      {receipt.unit_number || '-'}                    
                                                                                     {receipt.contract_number || '-'}                    
                                                           
                                               
                                          
                                      

                                {/* Row 2: Contract dates */}
                                                                                                                                
                                                     
                                                       
                                                                                  
                                                                                       {receipt.period_start || '-'} م                    
                                                                                              {receipt.period_start_hijri || '-'}                    
                                                           
                                              
                                                       
                                                                                  
                                                                                       {receipt.period_end || '-'} م                    
                                                                                              {receipt.period_end_hijri || '-'}                    
                                                           
                                              
                                          
                                       

                                {/* Row 3: Payment details */}
                                                                       
                                                                    
                                                       
                                                                                   المبلغ المستلم (ر.س)      
                                                                                                       
                                                {sarFormatter(receipt.amount_received || 0)}
                                                  
                                                                                        
                                                المبلغ رقماً وكتابةً: {receipt.amount_received ? receipt.amount_received : 0} ريال سعودي فقط لا غير.
                                                  
                                              
                                                                                                          
                                                                                                                  
                                                {receipt.payment_method === 'Bank Transfer' ? 'تحويل بنكي' : 'نقدي / كاش'}
                                                  
                                              
                                          
                                                                
                                                     
                                                       
                                                                   الإيجار السنوي المتوقع:        
                                                                        {sarFormatter(receipt.monthly_rent || 0)}       
                                              
                                                                                                           
                                                                   المتبقي من العقد:        
                                                                                     {sarFormatter(receipt.remaining_balance || 0)}       
                                              
                                          
                                      

                                {/* Footer & Authentication Badge */}
                                                                                                              
                                         
                                              سند معتمد رقمياً وبشكل رسمي       
                                                              بواسطة: {displayUsername(receipt.created_by_email)}      
                                          
                                                                                             
                                              تاريخ الإصدار:        
                                              {receipt.created_at ? dayjs(receipt.created_at).format('YYYY-MM-DD HH:mm:ss') : ''}       
                                          
                                      
                                  
                              
                          
                        
            );
        };

        const ExpenseVoucherModal = ({ voucher, visible, onClose }) => {
            if (!voucher) return null;

            const handlePrint = () => {
                window.print();
            };

            const translateCategory = (cat) => {
                if (!cat) return '-';
                switch(cat) {
                    case 'Maintenance': return 'صيانة';
                    case 'Utilities': return 'خدمات';
                    case 'General': return 'أخرى';
                    default: return cat; // Custom categories stored directly
                }
            };

            return (
                                                                                                                                                                                                                  إغلاق         ,
                                                                                                    🖨️       } onClick={handlePrint} className="bg-red-600 hover:bg-opacity-90 no-print border-red-600">طباعة السند / حفظ PDF         
                    ]}
                    width={750}
                    bodyStyle={{ padding: 0 }}
                >
                                                               
                                                                            
                            {/* Status Banner */}
                            {voucher.approval_status === 'pending' && (
                                                                                                                                      
                                    ⚠️ هذا السند قيد المراجعة والاعتماد ولم يتم ترحيله للحسابات بعد
                                      
                            )}
                            {voucher.approval_status === 'rejected' && (
                                                                                                                                  
                                    ❌ هذا السند مرفوض وغير معتمد ماليّاً
                                      
                            )}
                                                               سند صرف      
                            
                            {/* Header Band */}
                                                                                                   
                                     
                                                                                                              
                                                            سند صرف إلكتروني
                                         
                                                                                  بوابة تحصيل الإيجارات السعودية    
                                      
                                                                                         
                                                                       رقم السند: {voucher.voucher_number}      
                                                                               
                                        التاريخ: {voucher.created_at ? dayjs(voucher.created_at).format('YYYY-MM-DD م') : ''}
                                        {voucher.created_at ? ` | ${toHijriShort(voucher.created_at)} هـ` : ''}
                                          
                                      
                                  

                            {/* Body */}
                                                                         
                                {/* Row 1: Property and Unit */}
                                                       
                                                   
                                                                                                                                  
                                                                                  
                                                                                  {voucher.building_name || '-'}                    
                                                                                      {voucher.unit_number || '-'}                    
                                                           
                                               
                                          
                                                   
                                                                                                                                    
                                                                                  
                                                                                       {translateCategory(voucher.category)}                    
                                                                                       {voucher.payment_method === 'Bank Transfer' ? 'تحويل بنكي' : 'نقدي / كاش'}                    
                                                           
                                               
                                          
                                      

                                {/* Row 2: Description */}
                                                                                                                     
                                                                                        
                                        {voucher.description || '-'}
                                          
                                       

                                {/* Row 3: Amount details */}
                                                                                      
                                                                    
                                                       
                                                                                   المبلغ المنصرف (ر.س)      
                                                                                                       
                                                {sarFormatter(voucher.amount || 0)}
                                                  
                                                                                        
                                                المبلغ رقماً وكتابةً: {voucher.amount ? voucher.amount : 0} ريال سعودي فقط لا غير.
                                                  
                                              
                                          
                                      

                                {/* Row 4: Manager Approval Stamp */}
                                {voucher.approved_by && (
                                                                                                                                       
                                                                                                                                                               🔏      
                                             
                                                                                                                            اعتماد رسمي — معتمد من المسؤول      
                                                                                                     {voucher.approved_by}      
                                                                                               وافق وأعتمد صرف هذا المبلغ بتاريخ {voucher.created_at ? dayjs(voucher.created_at).format('YYYY-MM-DD HH:mm') : ''}      
                                              
                                          
                                )}

                                {/* Row 5: Signature Lines */}
                                                                                                  
                                                                             
                                                      
                                                                                         المستلم / المستفيد      
                                                                                                                               التوقيع والاسم      
                                              
                                                      
                                                                                         المحاسب      
                                                                                                                               التوقيع والاسم      
                                              
                                                      
                                                                                                       🔏 المسؤول المعتمِد      
                                                                                                       {voucher.approved_by || 'مدير العقار / المالك'}      
                                                                                                                                   الاعتماد والتوقيع الرسمي      
                                              
                                          
                                      

                                {/* Footer & Authentication Badge */}
                                                                                                                                       
                                         
                                              سند صرف معتمد رقمياً وبشكل رسمي       
                                                              بواسطة: {displayUsername(voucher.created_by_email)}      
                                          
                                                                                             
                                              تاريخ الإصدار:        
                                              {voucher.created_at ? dayjs(voucher.created_at).format('YYYY-MM-DD HH:mm:ss') : ''}       
                                          
                                      
                                  
                              
                          
                        
            );
        };


        const Login = ({ onLogin }) => {
            const [loading, setLoading] = useState(false);
            const [email, setEmail] = useState("");
            const [password, setPassword] = useState("");

            const handleLogin = async () => {
                setLoading(true);
                const processedEmail = processUsername(email);
                const { data, error } = await supabase.auth.signInWithPassword({ 
                    email: processedEmail, 
                    password 
                });
                if (error) {
                    message.error("خطأ في تسجيل الدخول: " + error.message);
                } else {
                    message.success("تم تسجيل الدخول بنجاح");
                    logActivity('LOGIN', 'AUTH', data.user.id, `تم تسجيل دخول المستخدم بنجاح: ${data.user.email}`);
                    onLogin(data.user);
                }
                setLoading(false);
            };

            return (
                                                                                                             
                                                                                            
                                                          
                                                                                                                                     
                                                                                  
                                  
                                                                            بوابة تحصيل الإيجارات        
                                                   المملكة العربية السعودية       
                              
                                                                       
                                                                     
                                                                                                   }
                                    placeholder="مثال: khaled"
                                    size="large"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                />
                                        
                                                                    
                                                                                                                                                                                                                                                                    setPassword(e.target.value)}
                                />
                                        
                                                                                                                                                                                                                                                                                                                                                                                       
                                تسجيل الدخول
                                     
                               
                           
                      
            );
        };

        const Dashboard = ({ stats }) => {
            return (
                                           
                                           
                                            
                                                                                          
                                                                                                                                                                                                                                                                }
                                />
                                   
                              
                                            
                                                                                          
                                                                                                                                                                                                                                                               }
                                />
                                   
                              
                                            
                                                                                          
                                                                                                                                                                                                                                                                  }
                                />
                                   
                              
                          

                                           
                                            
                                                                                          
                                                                                                                                                                                                                                                                                                                       }
                                />
                                   
                              
                                            
                                                                                          
                                                                                                                                                                                                                                                                                                                          }
                                />
                                   
                              
                                            
                                                                                          
                                                                                                                                                                                                                                                                                                                               }
                                />
                                   
                              
                          

                                                                              
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          {v}       },
                                { title: 'شاغرة', dataIndex: 'vacantCount', key: 'vacantCount', render: v =>                    {v}       },
                                { title: 'الإيجار', dataIndex: 'expected', key: 'expected', render: v => sarFormatter(v) },
                                { title: 'المحصل', dataIndex: 'paid', key: 'paid', render: v => sarFormatter(v) },
                                { title: 'المتبقى', dataIndex: 'remaining', key: 'remaining', render: v =>                 0 ? 'danger' : 'success'}>{sarFormatter(v)}        }
                            ]}
                        />
                           
                      
            );
        };


        const BuildingManager = ({ profile, cities }) => {
            const [buildings, setBuildings] = useState([]);
            const [loading, setLoading] = useState(true);
            const [isModalOpen, setIsModalOpen] = useState(false);
            const [selectedBuilding, setSelectedBuilding] = useState(null);
            const [form] = Form.useForm();

            const fetchBuildings = useCallback(async () => {
                setLoading(true);
                const { data: bData, error: bError } = await supabase
                    .from('buildings')
                    .select('*');

                if (!bError && bData.length > 0) {
                    // RBAC: Filter buildings by assigned_buildings for non-admin users
                    const assignedIds = getAssignedBuildingIds(profile);
                    const filteredBData = assignedIds === null ? bData : bData.filter(b => assignedIds.includes(b.id));

                    const bIds = filteredBData.map(b => b.id);
                    const { data: uData } = bIds.length > 0 
                        ? await supabase.from('units').select('building_id, monthly_rent, amount_paid, is_rented').in('building_id', bIds)
                        : { data: [] };

                    const buildingsWithStats = filteredBData.map(b => {
                        const bUnits = uData?.filter(u => u.building_id === b.id) || [];
                        const rentedUnits = bUnits.filter(u => u.is_rented);
                        const totalExpected = rentedUnits.reduce((acc, u) => acc + (u.monthly_rent || 0), 0);
                        const totalPaid = rentedUnits.reduce((acc, u) => acc + (u.amount_paid || 0), 0);
                        const rentedCount = rentedUnits.length;
                        return {
                            ...b,
                            unit_count: bUnits.length || b.unit_count || 0,
                            total_expected: totalExpected,
                            total_paid: totalPaid,
                            total_remaining: totalExpected - totalPaid,
                            rented_count: rentedCount
                        };
                    });
                    setBuildings(buildingsWithStats);
                } else {
                    setBuildings([]);
                }
                setLoading(false);
            }, [profile]);

            useEffect(() => { fetchBuildings(); }, [fetchBuildings]);

            useEffect(() => {
                const params = new URLSearchParams(window.location.search);
                const bId = params.get('building_id') || window.location.hash.replace('#', '');
                if (bId) {
                    const loadBuilding = async () => {
                        const { data } = await supabase.from('buildings').select('*').eq('id', bId).maybeSingle();
                        if (data) {
                            setSelectedBuilding({ ...data, viewUnits: true });
                        }
                    };
                    loadBuilding();
                }
            }, []);

            const handleSave = async (values) => {
                let cityId = values.city_id;
                if (cityId === 'ADD_NEW_CITY') {
                    const trimmedName = (values.new_city_name || '').trim();
                    // Check if a city with the same name already exists
                    const { data: existingCities } = await supabase
                        .from('cities')
                        .select('id, name_ar')
                        .eq('name_ar', trimmedName)
                        .limit(1);

                    if (existingCities && existingCities.length > 0) {
                        // City already exists — reuse its id
                        cityId = existingCities[0].id;
                        message.info(`المدينة "${trimmedName}" موجودة بالفعل وسيتم استخدامها.`);
                    } else {
                        const newCityId = (typeof crypto !== 'undefined' && crypto.randomUUID) 
                            ? crypto.randomUUID() 
                            : 'c-' + Date.now();
                        const newCityData = {
                            id: newCityId,
                            name_ar: trimmedName,
                            country: 'السعودية',
                            flag: '🇸🇦',
                            icon: '🏙️'
                        };
                        const { error: cityError } = await supabase.from('cities').insert([newCityData]);
                        if (cityError) {
                            message.error("خطأ في إضافة المدينة: " + cityError.message);
                            return;
                        }
                        cityId = newCityId;
                    }
                }

                const { new_city_name, ...buildingValues } = values;
                buildingValues.city_id = cityId;

                let query = supabase.from('buildings');
                let targetId = selectedBuilding?.id;
                if (selectedBuilding) {
                    query = query.update(buildingValues).eq('id', selectedBuilding.id);
                } else {
                    const newBuildingId = (typeof crypto !== 'undefined' && crypto.randomUUID)
                        ? crypto.randomUUID()
                        : 'b-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
                    targetId = newBuildingId;
                    query = query.insert([{ id: newBuildingId, ...buildingValues }]);
                }
                const { error } = await query;

                if (error) {
                    message.error("خطأ: " + error.message);
                } else {
                    message.success("تم الحفظ بنجاح");
                    setIsModalOpen(false);
                    fetchBuildings();
                    
                    const actionName = selectedBuilding ? 'UPDATE' : 'INSERT';
                    const cityName = cities.find(c => c.id === buildingValues.city_id)?.name_ar || '';
                    const desc = selectedBuilding 
                        ? `تم تعديل بيانات عمارة: ${buildingValues.name} (المدينة: ${cityName})`
                        : `تمت إضافة عمارة جديدة باسم: ${buildingValues.name} (المدينة: ${cityName})`;
                    logActivity(actionName, 'REAL_ESTATE', targetId, desc);
                }
            };

            const handleDelete = async (id) => {
                Modal.confirm({
                    title: 'هل أنت متأكد من الحذف؟',
                    content: 'سيتم حذف المبنى وجميع الوحدات المرتبطة به.',
                    okText: 'نعم، احذف',
                    okType: 'danger',
                    cancelText: 'إلغاء',
                    onOk: async () => {
                        const targetBuilding = buildings.find(b => b.id === id);
                        const bName = targetBuilding?.name || id;
                        const { error } = await supabase.from('buildings').delete().eq('id', id);
                        if (error) message.error(error.message);
                        else {
                            message.success("تم الحذف");
                            logActivity('DELETE', 'REAL_ESTATE', id, `تم حذف عمارة: ${bName}`);
                            fetchBuildings();
                        }
                    }
                });
            };

            return (
                                           
                                                                                                         
                                            
                                                               إدارة العقارات        
                                
                        {(profile?.can_add || profile?.role === 'admin') && (
                                                                         } onClick={() => { setSelectedBuilding(null); form.resetFields(); setIsModalOpen(true); }}>إضافة مبنى جديد         
                        )}
                          

                                                                                                                                                                                                                                                                                                                                                                                       cities.find(c => c.id === cid)?.name_ar || '-' },
                            { title: 'العنوان', dataIndex: 'address', key: 'address' },
                            { title: 'المسؤول عن المبنى', dataIndex: 'manager_name', key: 'manager_name' },
                            { title: 'عدد الوحدات', dataIndex: 'unit_count', key: 'unit_count' },
                            { title: 'عدد الوحدات المؤجرة', dataIndex: 'rented_count', key: 'rented_count' },
                            { title: 'الإيجار', dataIndex: 'total_expected', key: 'total_expected', render: v => sarFormatter(v) },
                            { title: 'المحصل', dataIndex: 'total_paid', key: 'total_paid', render: v => sarFormatter(v) },
                            { title: 'المتبقى', dataIndex: 'total_remaining', key: 'total_remaining', render: v =>                 0 ? 'danger' : 'success'}>{sarFormatter(v)}        },
                            {
                                title: 'إجراءات',
                                key: 'actions',
                                render: (_, record) => (
                                           
                                        {(profile?.can_edit || profile?.role === 'admin') && (
                                                                          } onClick={() => { setSelectedBuilding(record); form.setFieldsValue(record); setIsModalOpen(true); }} />
                                        )}
                                                                      } onClick={() => setSelectedBuilding({ ...record, viewUnits: true })}>الوحدات         
                                        {(profile?.can_delete || profile?.role === 'admin') && (
                                                                                   } onClick={() => handleDelete(record.id)} />
                                        )}
                                            
                                )
                            }
                        ]}
                    />

                                                                                                                                                                                                  setIsModalOpen(false)}
                        onOk={() => form.submit()}
                    >
                                                                                  
                                                                                                   
                                         
                                        
                                                                      
                                         
                                        
                                                                                                                                                                         
                                         
                                        
                                                                                      
                                                                          
                                        
                                                                                                   
                                                                                                                                                                                                                                                                                                                                                           ({ label: c.name_ar, value: c.id })),
                                        { label: '➕ إضافة مدينة جديدة...', value: 'ADD_NEW_CITY' }
                                    ]} 
                                />
                                        
                            
                                                                             prev.city_id !== curr.city_id}>
                                {({ getFieldValue }) => getFieldValue('city_id') === 'ADD_NEW_CITY' && (
                                                                                                                                                                                                                                                                                                                                          
                                                                                 
                                                
                                )}
                                        
                               
                            

                    {selectedBuilding?.viewUnits && (
                                                                                                                                                                                                                                {
                                setSelectedBuilding(null);
                                fetchBuildings();
                            }}
                        />
                    )}
                      
            );
        };

        const UnitLedger = ({ building, onBack, profile, cities }) => {
            const [units, setUnits] = useState([]);
            const [loading, setLoading] = useState(true);
            const [isModalOpen, setIsModalOpen] = useState(false);
            const [selectedUnit, setSelectedUnit] = useState(null);
            const [form] = Form.useForm();

            // Expiration Checker
            const isLeaseExpired = (periodEnd) => {
                if (!periodEnd) return false;
                const today = dayjs().startOf('day');
                const end = dayjs(periodEnd).startOf('day');
                return end.isBefore(today);
            };

            // Unit Profile & Lifecycle States
            const [unitProfileOpen, setUnitProfileOpen] = useState(false);
            const [archivedContracts, setArchivedContracts] = useState([]);
            const [renewalModalOpen, setRenewalModalOpen] = useState(false);
            const [renewalForm] = Form.useForm();
            const [renewalLiveStartDate, setRenewalLiveStartDate] = useState(null);
            const [renewalLiveEndDate, setRenewalLiveEndDate] = useState(null);
            const [settlementAction, setSettlementAction] = useState(null);
            const [newRentValue, setNewRentValue] = useState(0);

            // Receipt States
            const [receiptHistoryOpen, setReceiptHistoryOpen] = useState(false);
            const [selectedUnitReceipts, setSelectedUnitReceipts] = useState([]);
            const [activeReceipt, setActiveReceipt] = useState(null);
            const [receiptModalVisible, setReceiptModalVisible] = useState(false);

            // Live Date States for Form
            const [liveStartDate, setLiveStartDate] = useState(null);
            const [liveEndDate, setLiveEndDate] = useState(null);

            // Expense States
            const [receipts, setReceipts] = useState([]);
            const [expenses, setExpenses] = useState([]);
            const [expenseModalOpen, setExpenseModalOpen] = useState(false);
            const [activeExpense, setActiveExpense] = useState(null);
            const [expensePreviewVisible, setExpensePreviewVisible] = useState(false);
            const [activeTabKey, setActiveTabKey] = useState('1');
            const [expenseForm] = Form.useForm();
            const [generatedVoucherNum, setGeneratedVoucherNum] = useState('');
            const [showCustomCategory, setShowCustomCategory] = useState(false);
            const [balanceWarning, setBalanceWarning] = useState('');
            const [expensePaymentMethod, setExpensePaymentMethod] = useState('Cash');

            // RBAC: 403 Guard - Block access to unassigned buildings
            if (!isAssignedBuilding(profile, building?.id)) {
                return (
                                                                                                                                                                                                                                                                                             
                                                                                          
                                                                                                                                
                              
                             
                );
            }

            const fetchFinancialData = useCallback(async () => {
                const { data: rData, error: rError } = await supabase
                    .from('receipts')
                    .select('*')
                    .eq('building_id', building.id);
                
                const { data: eData, error: eError } = await supabase
                    .from('vouchers_expense')
                    .select('*')
                    .eq('building_id', building.id)
                    .order('created_at', { ascending: false });

                if (!rError) setReceipts(rData || []);
                if (!eError) setExpenses(eData || []);
            }, [building.id]);

            const fetchUnits = useCallback(async () => {
                setLoading(true);
                const { data, error } = await supabase
                    .from('units')
                    .select('*')
                    .eq('building_id', building.id)
                    .order('unit_number');
                if (!error) setUnits(data);
                await fetchFinancialData();
                setLoading(false);
            }, [building.id, fetchFinancialData]);

            useEffect(() => { fetchUnits(); }, [fetchUnits]);

            const onFormValuesChange = (changedValues) => {
                if (changedValues.rent_period) {
                    const [start, end] = changedValues.rent_period || [null, null];
                    setLiveStartDate(start ? start.toDate() : null);
                    setLiveEndDate(end ? end.toDate() : null);
                }
            };

            const handleOpenExpenseModal = async (unit) => {
                setSelectedUnit(unit);
                expenseForm.resetFields();
                expenseForm.setFieldsValue({ payment_method: 'Cash' });
                setShowCustomCategory(false);
                setBalanceWarning('');
                setExpensePaymentMethod('Cash');
                const num = await generateExpenseVoucherNumber();
                setGeneratedVoucherNum(num);
                setExpenseModalOpen(true);
            };

            // Compute current cash balance for real-time validation (only count approved expenses)
            const getCurrentCashBalance = () => {
                const cashIn = receipts.filter(r => r.payment_method === 'Cash').reduce((acc, r) => acc + (r.amount_received || 0), 0);
                const cashOut = expenses.filter(e => e.payment_method === 'Cash' && e.approval_status === 'approved').reduce((acc, e) => acc + (e.amount || 0), 0);
                return cashIn - cashOut;
            };

            const handleExpenseFormValuesChange = (changedValues, allValues) => {
                const payMethod = allValues.payment_method || expensePaymentMethod;
                if (changedValues.payment_method) setExpensePaymentMethod(changedValues.payment_method);
                if (changedValues.category !== undefined) {
                    setShowCustomCategory(changedValues.category === 'Custom');
                }
                // Live balance check
                const amount = allValues.amount || 0;
                if ((payMethod === 'Cash') && amount > 0) {
                    const balance = getCurrentCashBalance();
                    if (amount > balance) {
                        setBalanceWarning(`تنبيه: رصيد الكاش الحالي في العمارة (${sarFormatter(balance)}) غير كافي لتغطية هذا المبلغ. يرجى تعديل قيمة المصروف أو تغيير طريقة الدفع.`);
                    } else {
                        setBalanceWarning('');
                    }
                } else {
                    setBalanceWarning('');
                }
            };

            const handleSaveExpense = async (values) => {
                try {
                    // Balance guard — block cash overdraft
                    if (values.payment_method === 'Cash') {
                        const balance = getCurrentCashBalance();
                        if (values.amount > balance) {
                            setBalanceWarning(`تنبيه: رصيد الكاش الحالي في العمارة (${sarFormatter(balance)}) غير كافي لتغطية هذا المبلغ. يرجى تعديل قيمة المصروف أو تغيير طريقة الدفع.`);
                            return;
                        }
                    }
                    
                    const isAdmin = profile?.role === 'admin';
                    
                    // Approval confirmation guard (only for admin)
                    if (isAdmin && !values.approval_confirmed) {
                        message.error('يجب تأكيد الاعتماد من المسؤول قبل الحفظ.');
                        return;
                    }

                    const finalCategory = values.category === 'Custom'
                        ? (values.custom_category_label || 'أخرى')
                        : values.category;

                    const currentUser = (await supabase.auth.getUser()).data.user;
                    const expenseData = {
                        voucher_number: generatedVoucherNum,
                        unit_id: selectedUnit ? selectedUnit.id : null,
                        building_id: building.id,
                        user_id: currentUser ? currentUser.id : null,
                        category: finalCategory,
                        amount: values.amount,
                        payment_method: values.payment_method,
                        description: values.description,
                        approval_status: isAdmin ? 'approved' : 'pending',
                        approved_by: isAdmin ? (values.approved_by || profile?.name || profile?.email || 'مدير العقار') : '',
                        approval_date: isAdmin ? new Date().toISOString() : null
                    };

                    const { data: insertedVoucher, error } = await supabase
                        .from('vouchers_expense')
                        .insert([expenseData])
                        .select()
                        .single();

                    if (error) throw error;

                    message.success("تم تسجيل سند الصرف بنجاح");
                    logActivity('INSERT', 'EXPENSES', insertedVoucher?.id, `تم تسجيل سند صرف جديد برقم: ${insertedVoucher?.voucher_number} بقيمة ${values.amount} ر.س تحت بند: ${finalCategory}`);
                    setExpenseModalOpen(false);
                    
                    const voucherForPrint = {
                        ...insertedVoucher,
                        building_name: building.name,
                        unit_number: selectedUnit ? selectedUnit.unit_number : 'عام للمبنى',
                        created_by_email: currentUser ? currentUser.email : ''
                    };

                    setActiveExpense(voucherForPrint);
                    setExpensePreviewVisible(true);
                    fetchUnits();
                } catch (e) {
                    message.error("خطأ أثناء حفظ سند الصرف: " + e.message);
                }
            };

            const handleDeleteExpense = async (voucher) => {
                Modal.confirm({
                    title: 'تأكيد حذف سند الصرف',
                    content: `هل أنت متأكد من حذف سند الصرف رقم ${voucher.voucher_number} بقيمة ${sarFormatter(voucher.amount)}؟ لا يمكن التراجع عن هذا الإجراء.`,
                    okText: 'نعم، احذف',
                    cancelText: 'إلغاء',
                    okType: 'danger',
                    onOk: async () => {
                        try {
                            const { error } = await supabase
                                .from('vouchers_expense')
                                .delete()
                                .eq('id', voucher.id);
                            if (error) throw error;
                            message.success("تم حذف سند الصرف بنجاح");
                            logActivity('DELETE', 'EXPENSES', voucher.id, `تم حذف سند الصرف رقم: ${voucher.voucher_number} بقيمة ${voucher.amount} ر.س`);
                            fetchUnits();
                        } catch (e) {
                            message.error("فشل حذف سند الصرف: " + e.message);
                        }
                    }
                });
            };

            const handleApproveExpense = async (voucher) => {
                Modal.confirm({
                    title: 'تأكيد اعتماد سند الصرف',
                    content: `هل أنت متأكد من اعتماد سند الصرف رقم ${voucher.voucher_number} بقيمة ${sarFormatter(voucher.amount)}؟ سيتم خصم هذا المبلغ من كشف حساب العمارة.`,
                    okText: 'نعم، اعتمد',
                    cancelText: 'إلغاء',
                    onOk: async () => {
                        try {
                            const { error } = await supabase
                                .from('vouchers_expense')
                                .update({
                                    approval_status: 'approved',
                                    approved_by: profile?.name || profile?.email || 'مدير العقار',
                                    approval_date: new Date().toISOString()
                                })
                                .eq('id', voucher.id);
                            if (error) throw error;
                            message.success("تم اعتماد سند الصرف بنجاح");
                            logActivity('UPDATE', 'EXPENSES', voucher.id, `تم اعتماد سند الصرف رقم: ${voucher.voucher_number} بقيمة ${voucher.amount} ر.س`);
                            fetchUnits();
                        } catch (e) {
                            message.error("فشل اعتماد سند الصرف: " + e.message);
                        }
                    }
                });
            };

            const handleRejectExpense = async (voucher) => {
                Modal.confirm({
                    title: 'تأكيد رفض سند الصرف',
                    content: `هل أنت متأكد من رفض سند الصرف رقم ${voucher.voucher_number} بقيمة ${sarFormatter(voucher.amount)}؟ لن يتم خصم هذا المبلغ من كشف حساب العمارة.`,
                    okText: 'نعم، ارفض',
                    cancelText: 'إلغاء',
                    okType: 'danger',
                    onOk: async () => {
                        try {
                            const { error } = await supabase
                                .from('vouchers_expense')
                                .update({
                                    approval_status: 'rejected',
                                    approved_by: profile?.name || profile?.email || 'مدير العقار',
                                    approval_date: new Date().toISOString()
                                })
                                .eq('id', voucher.id);
                            if (error) throw error;
                            message.success("تم رفض سند الصرف بنجاح");
                            logActivity('UPDATE', 'EXPENSES', voucher.id, `تم رفض سند الصرف رقم: ${voucher.voucher_number} بقيمة ${voucher.amount} ر.س`);
                            fetchUnits();
                        } catch (e) {
                            message.error("فشل رفض سند الصرف: " + e.message);
                        }
                    }
                });
            };


            const handleSave = async (values) => {
                const { rent_period, amount_received, ...rest } = values;
                const prevPaid = selectedUnit ? (selectedUnit.amount_paid || 0) : 0;
                const expectedRent = values.monthly_rent || 0;
                const remainingBefore = Math.max(0, expectedRent - prevPaid);
                let finalReceived = amount_received || 0;

                if (finalReceived > remainingBefore) {
                    finalReceived = remainingBefore;
                    message.warning(`تم تقليص المبلغ المستلم تلقائياً إلى ${sarFormatter(finalReceived)} ليغطي المتبقي فقط.`);
                }

                const newPaidTotal = prevPaid + finalReceived;

                const unitData = {
                    ...rest,
                    building_id: building.id,
                    period_start: rent_period && rent_period[0] ? rent_period[0].format('YYYY-MM-DD') : null,
                    period_end: rent_period && rent_period[1] ? rent_period[1].format('YYYY-MM-DD') : null,
                    amount_paid: values.is_rented ? newPaidTotal : 0,
                    contract_number: values.contract_number
                };

                let unitId = selectedUnit ? selectedUnit.id : null;
                try {
                    if (selectedUnit) {
                        const { error } = await supabase.from('units').update(unitData).eq('id', selectedUnit.id);
                        if (error) throw error;
                    } else {
                        // Generate a UUID client-side since the units table id has no DEFAULT
                        const newId = (typeof crypto !== 'undefined' && crypto.randomUUID)
                            ? crypto.randomUUID()
                            : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
                                const r = Math.random() * 16 | 0;
                                return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
                              });
                        const { data, error } = await supabase.from('units').insert([{ id: newId, ...unitData }]).select().single();
                        if (error) throw error;
                        unitId = data.id;
                    }

                    // If a payment was made, generate a receipt
                    if (values.is_rented && finalReceived > 0) {
                        const receiptNum = await generateReceiptNumber();
                        const currentUser = (await supabase.auth.getUser()).data.user;
                        const receiptData = {
                            receipt_number: receiptNum,
                            unit_id: unitId,
                            building_id: building.id,
                            user_id: currentUser ? currentUser.id : null,
                            tenant_name: values.tenant_name,
                            id_number: values.id_number,
                            phone_number: values.phone_number,
                            contract_number: values.contract_number,
                            unit_number: values.unit_number,
                            building_name: building.name,
                            city_name: cities.find(c => c.id === building.city_id)?.name_ar || '',
                            amount_received: finalReceived,
                            payment_method: values.payment_method,
                            period_start: rent_period && rent_period[0] ? rent_period[0].format('YYYY-MM-DD') : null,
                            period_end: rent_period && rent_period[1] ? rent_period[1].format('YYYY-MM-DD') : null,
                            period_start_hijri: rent_period && rent_period[0] ? toHijri(rent_period[0].toDate()) : null,
                            period_end_hijri: rent_period && rent_period[1] ? toHijri(rent_period[1].toDate()) : null,
                            monthly_rent: expectedRent,
                            remaining_balance: expectedRent - newPaidTotal,
                            created_by_email: currentUser ? currentUser.email : ''
                        };

                        const { data: insertedReceipt, error: recError } = await supabase.from('receipts').insert([receiptData]).select().single();
                        if (recError) throw recError;

                        message.success("تم حفظ الوحدة وإصدار السند بنجاح");
                        logActivity('INSERT', 'RECEIPTS', insertedReceipt?.id, `تم إصدار سند قبض جديد برقم: ${receiptNum} للمستأجر: ${values.tenant_name} بمبلغ ${finalReceived} ر.س`);
                        
                        if (insertedReceipt) {
                            setActiveReceipt(insertedReceipt);
                            setReceiptModalVisible(true);
                        }
                    } else {
                        message.success("تم حفظ البيانات بنجاح");
                    }

                    // Log unit insert/update
                    const actionName = selectedUnit ? 'UPDATE' : 'INSERT';
                    const desc = selectedUnit 
                        ? `تم تعديل بيانات الوحدة رقم: ${values.unit_number} في عمارة ${building.name}`
                        : `تمت إضافة وحدة جديدة برقم: ${values.unit_number} في عمارة ${building.name}`;
                    logActivity(actionName, 'UNITS', unitId, desc);

                    setIsModalOpen(false);
                    fetchUnits();
                } catch (error) {
                    message.error("خطأ أثناء الحفظ: " + error.message);
                }
            };

            const showReceiptHistory = async (unit) => {
                setLoading(true);
                const { data, error } = await supabase
                    .from('receipts')
                    .select('*')
                    .eq('unit_id', unit.id)
                    .order('created_at', { ascending: false });
                if (!error) {
                    setSelectedUnitReceipts(data || []);
                    setSelectedUnit(unit);
                    setReceiptHistoryOpen(true);
                } else {
                    message.error("خطأ في تحميل سجل السندات: " + error.message);
                }
                setLoading(false);
            };

            const showUnitProfile = async (unit) => {
                setLoading(true);
                try {
                    setSelectedUnit(unit);
                    
                    // Fetch receipts
                    const { data: recs, error: recsErr } = await supabase
                        .from('receipts')
                        .select('*')
                        .eq('unit_id', unit.id)
                        .order('created_at', { ascending: false });
                    if (recsErr) throw recsErr;
                    setSelectedUnitReceipts(recs || []);

                    // Fetch history archive (with fallback to log warning but allow normal UI)
                    let archs = [];
                    try {
                        const { data, error } = await supabase
                            .from('expired_contracts_archive')
                            .select('*')
                            .eq('unit_id', unit.id)
                            .order('archived_at', { ascending: false });
                        if (error) {
                            console.warn("Table expired_contracts_archive might not exist: ", error.message);
                        } else {
                            archs = data || [];
                        }
                    } catch (e) {
                        console.warn("Error fetching expired_contracts_archive: ", e);
                    }
                    setArchivedContracts(archs);

                    setUnitProfileOpen(true);
                } catch (err) {
                    message.error("خطأ في تحميل تفاصيل ملف الوحدة: " + err.message);
                } finally {
                    setLoading(false);
                }
            };

            const handleTerminateContract = async (unit) => {
                const remaining = (unit.monthly_rent || 0) - (unit.amount_paid || 0);
                
                const performTermination = async () => {
                    setLoading(true);
                    try {
                        // 1. Archive the contract
                        if (unit.contract_number && unit.tenant_name) {
                            try {
                                const archiveData = {
                                    unit_id: unit.id,
                                    building_id: unit.building_id,
                                    tenant_name: unit.tenant_name,
                                    id_number: unit.id_number || '',
                                    phone_number: unit.phone_number || '',
                                    contract_number: unit.contract_number,
                                    monthly_rent: unit.monthly_rent || 0,
                                    amount_paid: unit.amount_paid || 0,
                                    payment_method: unit.payment_method || 'Cash',
                                    period_start: unit.period_start,
                                    period_end: unit.period_end
                                };
                                const { error: archErr } = await supabase.from('expired_contracts_archive').insert([archiveData]);
                                if (archErr) {
                                    console.warn("Could not archive terminated lease: ", archErr.message);
                                }
                            } catch (e) {
                                console.warn("Failed to archive terminated lease: ", e);
                            }
                        }

                        // 2. Clear unit details to make it vacant
                        const { error: updateErr } = await supabase.from('units').update({
                            is_rented: false,
                            tenant_name: null,
                            id_number: null,
                            phone_number: null,
                            contract_number: null,
                            period_start: null,
                            period_end: null,
                            amount_paid: 0
                        }).eq('id', unit.id);

                        if (updateErr) throw updateErr;

                        message.success("تم إنهاء العقد وتفريغ الوحدة بنجاح");
                        logActivity('UPDATE', 'CONTRACTS', unit.id, `تم إنهاء عقد الإيجار للوحدة رقم: ${unit.unit_number} للمستأجر: ${unit.tenant_name}`);
                        
                        setUnitProfileOpen(false);
                        fetchUnits();
                    } catch (err) {
                        message.error("خطأ أثناء إنهاء العقد: " + err.message);
                    } finally {
                        setLoading(false);
                    }
                };

                Modal.confirm({
                    title: 'تأكيد إنهاء العقد',
                    content: remaining > 0 
                        ? `تنبيه: يوجد مبلغ متبقي غير محصل بقيمة ${sarFormatter(remaining)}. هل أنت متأكد من إنهاء العقد وإسقاط هذا المبلغ وتفريغ الوحدة؟`
                        : 'هل أنت متأكد من إنهاء عقد هذه الوحدة وتفريغها لاستقبال عقد جديد؟',
                    okText: 'نعم، أنهِ العقد',
                    cancelText: 'إلغاء',
                    okType: 'danger',
                    onOk: performTermination
                });
            };

            const handleRenewContract = async (values) => {
                setLoading(true);
                try {
                    const [start, end] = values.rent_period || [null, null];
                    const startDateStr = start ? start.format('YYYY-MM-DD') : null;
                    const endDateStr = end ? end.format('YYYY-MM-DD') : null;
                    
                    const oldRemaining = (selectedUnit.monthly_rent || 0) - (selectedUnit.amount_paid || 0);
                    const isDebt = oldRemaining > 0;
                    
                    let settlementStatus = null;
                    let finalCarriedDebtAmount = 0;
                    let oldContractFinalAmountPaid = selectedUnit.amount_paid || 0;
                    
                    // Option A: Cash Settlement
                    if (isDebt && values.settlement_action === 'settle') {
                        settlementStatus = 'Settled';
                        finalCarriedDebtAmount = 0;
                        const settledAmount = values.settled_amount || oldRemaining;
                        oldContractFinalAmountPaid += settledAmount;
                        
                        // Issue a final Receipt linked to the old contract number to bring its remaining balance to exactly zero
                        const settlementReceiptNum = await generateReceiptNumber();
                        const currentUser = (await supabase.auth.getUser()).data.user;
                        
                        const settlementReceiptData = {
                            receipt_number: settlementReceiptNum,
                            unit_id: selectedUnit.id,
                            building_id: selectedUnit.building_id,
                            user_id: currentUser ? currentUser.id : null,
                            tenant_name: selectedUnit.tenant_name,
                            id_number: selectedUnit.id_number || '',
                            phone_number: selectedUnit.phone_number || '',
                            contract_number: selectedUnit.contract_number, // Old contract
                            unit_number: selectedUnit.unit_number,
                            building_name: building.name,
                            city_name: cities.find(c => c.id === building.city_id)?.name_ar || '',
                            amount_received: settledAmount,
                            payment_method: values.settled_payment_method || 'Cash',
                            period_start: selectedUnit.period_start,
                            period_end: selectedUnit.period_end,
                            period_start_hijri: selectedUnit.period_start ? toHijri(selectedUnit.period_start) : null,
                            period_end_hijri: selectedUnit.period_end ? toHijri(selectedUnit.period_end) : null,
                            monthly_rent: selectedUnit.monthly_rent,
                            remaining_balance: Math.max(0, oldRemaining - settledAmount),
                            created_by_email: currentUser ? currentUser.email : ''
                        };

                        const { data: insertedSettRec, error: setRecError } = await supabase
                            .from('receipts')
                            .insert([settlementReceiptData])
                            .select()
                            .single();
                        
                        if (setRecError) throw setRecError;
                        
                        logActivity('INSERT', 'RECEIPTS', insertedSettRec?.id, `تم إصدار سند قبض تسوية برقم: ${settlementReceiptNum} للمستأجر: ${selectedUnit.tenant_name} بمبلغ ${settledAmount} ر.س لتسوية العقد رقم ${selectedUnit.contract_number}`);
                    }
                    
                    // Option B: Balance Rollover
                    if (isDebt && values.settlement_action === 'rollover') {
                        settlementStatus = 'Rolled_Over';
                        finalCarriedDebtAmount = oldRemaining;
                    }

                    // 1. Archive the old contract details
                    try {
                        const archiveData = {
                            unit_id: selectedUnit.id,
                            building_id: selectedUnit.building_id,
                            tenant_name: selectedUnit.tenant_name,
                            id_number: selectedUnit.id_number || '',
                            phone_number: selectedUnit.phone_number || '',
                            contract_number: selectedUnit.contract_number,
                            monthly_rent: selectedUnit.monthly_rent || 0,
                            amount_paid: oldContractFinalAmountPaid,
                            payment_method: selectedUnit.payment_method || 'Cash',
                            period_start: selectedUnit.period_start,
                            period_end: selectedUnit.period_end,
                            settlement_status: settlementStatus,
                            final_carried_debt_amount: finalCarriedDebtAmount
                        };
                        
                        const { error: archErr } = await supabase
                            .from('expired_contracts_archive')
                            .insert([archiveData]);
                        
                        if (archErr) {
                            console.warn("Could not archive renewed lease: ", archErr.message);
                        }
                    } catch (e) {
                        console.warn("Failed to archive renewed lease: ", e);
                    }

                    // 2. Update units table row with new contract parameters
                    // New Target Total = New Lease Base Rent + Rolled-forward Balance (if rollover)
                    const targetTotalRent = values.new_rent_value + (values.settlement_action === 'rollover' ? oldRemaining : 0);
                    
                    const updatedUnitData = {
                        is_rented: true,
                        tenant_name: values.tenant_name || selectedUnit.tenant_name,
                        id_number: values.id_number || selectedUnit.id_number,
                        phone_number: values.phone_number || selectedUnit.phone_number,
                        contract_number: values.new_contract_number,
                        monthly_rent: targetTotalRent,
                        period_start: startDateStr,
                        period_end: endDateStr,
                        amount_paid: values.amount_received || 0,
                        payment_method: values.payment_method
                    };

                    const { error: updateErr } = await supabase
                        .from('units')
                        .update(updatedUnitData)
                        .eq('id', selectedUnit.id);
                    
                    if (updateErr) throw updateErr;

                    // 3. Issue new receipt if amount_received > 0
                    if (values.amount_received > 0) {
                        const receiptNum = await generateReceiptNumber();
                        const currentUser = (await supabase.auth.getUser()).data.user;
                        const receiptData = {
                            receipt_number: receiptNum,
                            unit_id: selectedUnit.id,
                            building_id: selectedUnit.building_id,
                            user_id: currentUser ? currentUser.id : null,
                            tenant_name: values.tenant_name || selectedUnit.tenant_name,
                            id_number: values.id_number || selectedUnit.id_number,
                            phone_number: values.phone_number || selectedUnit.phone_number,
                            contract_number: values.new_contract_number,
                            unit_number: selectedUnit.unit_number,
                            building_name: building.name,
                            city_name: cities.find(c => c.id === building.city_id)?.name_ar || '',
                            amount_received: values.amount_received,
                            payment_method: values.payment_method,
                            period_start: startDateStr,
                            period_end: endDateStr,
                            period_start_hijri: start ? toHijri(start.toDate()) : null,
                            period_end_hijri: end ? toHijri(end.toDate()) : null,
                            monthly_rent: targetTotalRent,
                            remaining_balance: targetTotalRent - (values.amount_received || 0),
                            created_by_email: currentUser ? currentUser.email : ''
                        };

                        const { data: insertedReceipt, error: recError } = await supabase
                            .from('receipts')
                            .insert([receiptData])
                            .select()
                            .single();
                        
                        if (recError) throw recError;

                        message.success("تم تجديد العقد بنجاح وتوثيق التسوية/الترحيل المالي");
                        logActivity('INSERT', 'RECEIPTS', insertedReceipt?.id, `تم إصدار سند قبض جديد برقم: ${receiptNum} للمستأجر: ${values.tenant_name || selectedUnit.tenant_name} بمبلغ ${values.amount_received} ر.س`);
                        
                        if (insertedReceipt) {
                            setActiveReceipt(insertedReceipt);
                            setReceiptModalVisible(true);
                        }
                    } else {
                        message.success("تم تجديد العقد بنجاح وتوثيق التسوية/الترحيل المالي");
                    }

                    // Log renewal action
                    logActivity('RENEWAL', 'CONTRACTS', selectedUnit.id, `تم تجديد عقد الوحدة رقم: ${selectedUnit.unit_number} للمستأجر: ${values.tenant_name || selectedUnit.tenant_name} بعقد جديد رقم: ${values.new_contract_number} وقيمة ${targetTotalRent} ر.س`);

                    setRenewalModalOpen(false);
                    setUnitProfileOpen(false);
                    fetchUnits();
                } catch (err) {
                    message.error("خطأ أثناء تجديد العقد: " + err.message);
                } finally {
                    setLoading(false);
                }
            };
            const handleDeleteReceipt = async (receipt) => {
                Modal.confirm({
                    title: 'تأكيد حذف السند',
                    content: `هل أنت متأكد من حذف السند رقم ${receipt.receipt_number}؟ سيتم خصم مبلغ ${sarFormatter(receipt.amount_received)} من إجمالي المحصل للوحدة.`,
                    okText: 'نعم، احذف',
                    cancelText: 'إلغاء',
                    okType: 'danger',
                    onOk: async () => {
                        try {
                            const { data: curUnit, error: fetchErr } = await supabase
                                .from('units')
                                .select('amount_paid')
                                .eq('id', receipt.unit_id)
                                .single();
                            if (fetchErr) throw fetchErr;

                            const curPaid = curUnit.amount_paid || 0;
                            const newPaid = Math.max(0, curPaid - (receipt.amount_received || 0));

                            const { error: updateErr } = await supabase
                                .from('units')
                                .update({ amount_paid: newPaid })
                                .eq('id', receipt.unit_id);
                            if (updateErr) throw updateErr;

                            const { error: delErr } = await supabase
                                .from('receipts')
                                .delete()
                                .eq('id', receipt.id);
                            if (delErr) throw delErr;

                            message.success("تم حذف السند وتحديث المحصل للوحدة بنجاح");
                            logActivity('DELETE', 'RECEIPTS', receipt.id, `تم حذف سند قبض رقم: ${receipt.receipt_number} للمستأجر: ${receipt.tenant_name}`);
                            
                            fetchUnits();
                            showReceiptHistory(selectedUnit || { id: receipt.unit_id });
                            if (selectedUnit) {
                                setSelectedUnit(prev => ({ ...prev, amount_paid: newPaid }));
                            }
                        } catch (e) {
                            message.error("فشل حذف السند: " + e.message);
                        }
                    }
                });
            };

            const handleEditReceiptAmount = async (receipt) => {
                const newAmountStr = prompt(`تعديل مبلغ السند ${receipt.receipt_number}:`, receipt.amount_received);
                if (newAmountStr === null) return;
                const newAmount = parseFloat(newAmountStr);
                if (isNaN(newAmount) || newAmount                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              ({ ...prev, amount_paid: newPaid }));
                    }
                } catch (e) {
                    message.error('فشل تعديل السند: ' + e.message);
                }
            };


            // Calculate financial aggregates (only count approved expenses)
            const totalCollected = receipts.reduce((acc, r) => acc + (r.amount_received || 0), 0);
            const totalSpent = expenses.filter(e => e.approval_status === 'approved').reduce((acc, e) => acc + (e.amount || 0), 0);

            const cashCollected = receipts.filter(r => r.payment_method === 'Cash').reduce((acc, r) => acc + (r.amount_received || 0), 0);
            const cashSpent = expenses.filter(e => e.payment_method === 'Cash' && e.approval_status === 'approved').reduce((acc, e) => acc + (e.amount || 0), 0);
            const netCashBalance = cashCollected - cashSpent;

            const computedLedger = useMemo(() => {
                const ledgerItems = [
                    ...receipts.map(r => ({
                        id: r.id,
                        date: r.created_at,
                        type: 'receipt',
                        refNumber: r.receipt_number,
                        category: 'إيراد إيجار',
                        description: `دفعة إيجار - الوحدة ${r.unit_number} - المستأجر: ${r.tenant_name || '-'}`,
                        income: r.amount_received || 0,
                        expense: 0,
                        paymentMethod: r.payment_method === 'Bank Transfer' ? 'تحويل بنكي' : 'كاش',
                        rawItem: r
                    })),
                    ...expenses.filter(e => e.approval_status === 'approved').map(e => {
                        const catAr = e.category === 'Maintenance' ? 'صيانة' : e.category === 'Utilities' ? 'خدمات' : 'أخرى';
                        const relatedUnit = units.find(u => u.id === e.unit_id);
                        return {
                            id: e.id,
                            date: e.created_at,
                            type: 'expense',
                            refNumber: e.voucher_number,
                            category: `مصروف (${catAr})`,
                            description: `${e.description || '-'} (الوحدة: ${relatedUnit ? relatedUnit.unit_number : 'عام للمبنى'})`,
                            income: 0,
                            expense: e.amount || 0,
                            paymentMethod: e.payment_method === 'Bank Transfer' ? 'تحويل بنكي' : 'كاش',
                            rawItem: e
                        };
                    })
                ];

                ledgerItems.sort((a, b) => new Date(a.date) - new Date(b.date));

                let balance = 0;
                const ledgerWithBalance = ledgerItems.map(item => {
                    balance += (item.income - item.expense);
                    return {
                        ...item,
                        balance
                    };
                });

                return ledgerWithBalance.sort((a, b) => new Date(b.date) - new Date(a.date));
            }, [receipts, expenses, units]);

            return (
                                                                                                                                                                                                                                                                                                     
                            {(profile?.can_add || profile?.role === 'admin') && (
                                                                             } onClick={() => { 
                                    setSelectedUnit(null); 
                                    setLiveStartDate(null);
                                    setLiveEndDate(null);
                                    form.resetFields(); 
                                    setIsModalOpen(true); 
                                }}>إضافة وحدة جديدة         
                            )}
                                
                    }
                >
                    {/* Financial Summary Dashboard */}
                                                                                            
                                               
                                                
                                                                                                                 
                                                                                                                                                                                                                                                                                                                                                                                                                                                         }
                                    />
                                       
                                  
                                                
                                                                                                             
                                                                                                                                                                                                                                                                                                                                                                                                                                                }
                                    />
                                       
                                  
                                                
                                                                                                               
                                                                                                                                                                                                                                                                                                                                        = 0 ? '#b58d1b' : '#cf222e', fontWeight: 'bold' }}
                                        prefix={                                             }
                                    />
                                                                                    حساب نقدي فقط: المحصل نقدي - المنصرف نقدي      
                                       
                                  
                              
                          

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  {
                                        if (record.is_rented && isLeaseExpired(record.period_end)) {
                                            return 'row-lease-expired';
                                        }
                                        return '';
                                    }}
                                    columns={[
                                        { title: 'رقم الوحدة', dataIndex: 'unit_number', key: 'unit_number' },
                                        { title: 'رقم العقد', dataIndex: 'contract_number', key: 'contract_number' },
                                        { title: 'المستأجر', dataIndex: 'tenant_name', key: 'tenant_name' },
                                        { title: 'رقم الهوية', dataIndex: 'id_number', key: 'id_number' },
                                        { title: 'رقم الجوال', dataIndex: 'phone_number', key: 'phone_number' },
                                        { 
                                            title: 'بداية العقد', 
                                            key: 'period_start_full',
                                            render: (_, record) => record.period_start ? (
                                                     
                                                         {record.period_start} م      
                                                                                           {toHijri(record.period_start)} هـ      
                                                      
                                            ) : '-'
                                        },
                                        { 
                                            title: 'نهاية العقد', 
                                            key: 'period_end_full',
                                            render: (_, record) => record.period_end ? (
                                                     
                                                         {record.period_end} م      
                                                                                           {toHijri(record.period_end)} هـ      
                                                      
                                            ) : '-'
                                        },
                                        {
                                            title: 'الحالة',
                                            key: 'lease_status',
                                            render: (_, record) => {
                                                if (!record.is_rented) {
                                                    return                    شاغرة      ;
                                                }
                                                if (isLeaseExpired(record.period_end)) {
                                                    return                                                منتهي الصلاحية      ;
                                                }
                                                return                      مؤجرة      ;
                                            }
                                        },
                                        { title: 'قيمة العقد المتوقعة', dataIndex: 'monthly_rent', key: 'monthly_rent', render: v => sarFormatter(v) },
                                        { title: 'المحصل', dataIndex: 'amount_paid', key: 'amount_paid', render: (v, record) => sarFormatter(record.is_rented ? v : 0) },
                                        {
                                            title: 'المتبقى',
                                            key: 'remaining',
                                            render: (_, record) => {
                                                if (!record.is_rented) return sarFormatter(0);
                                                const remaining = (record.monthly_rent || 0) - (record.amount_paid || 0);
                                                return                         0 ? 'danger' : 'success'}>{sarFormatter(remaining)}       ;
                                            }
                                        },
                                        {
                                            title: 'طريقة الدفع',
                                            dataIndex: 'payment_method',
                                            key: 'payment_method',
                                            render: (method) => method === 'Bank Transfer' ? 'تحويل بنكى' : 'كاش'
                                        },
                                        {
                                            title: 'إجراءات',
                                            key: 'actions',
                                            render: (_, record) => (
                                                       
                                                    {(profile?.can_delete || profile?.role === 'admin') && (
                                                                                                                                                                                                                                                           {
                                                                const { error } = await supabase.from('units').delete().eq('id', record.id);
                                                                if (error) message.error(error.message);
                                                                else {
                                                                    message.success("تم الحذف");
                                                                    logActivity('DELETE', 'UNITS', record.id, `تم حذف الوحدة رقم: ${record.unit_number} من عمارة ${building.name}`);
                                                                    fetchUnits();
                                                                }
                                                            }}
                                                            okText="نعم"
                                                            cancelText="لا"
                                                        >
                                                                                                   } />
                                                                     
                                                    )}
                                                    {(profile?.can_edit || profile?.role === 'admin') && (
                                                                                      } onClick={() => {
                                                            setSelectedUnit(record);
                                                            setLiveStartDate(record.period_start ? new Date(record.period_start) : null);
                                                            setLiveEndDate(record.period_end ? new Date(record.period_end) : null);
                                                            form.setFieldsValue({
                                                                ...record,
                                                                rent_period: record.period_start ? [dayjs(record.period_start), dayjs(record.period_end)] : null,
                                                                amount_received: 0
                                                            });
                                                            setIsModalOpen(true);
                                                        }} />
                                                    )}
                                                    {(profile?.can_edit || profile?.role === 'admin') && (
                                                                                               
                                                                                                                                                                                                                                                                                                                          } 
                                                                onClick={() => handleOpenExpenseModal(record)}
                                                            >
                                                                سند صرف
                                                                     
                                                                  
                                                    )}
                                                                                                           } onClick={() => showUnitProfile(record)}>ملف الوحدة         
                                                        
                                            )
                                        }
                                    ]}
                                />
                            )
                        },
                        {
                            key: '2',
                            label: 'كشف حساب العمارة (دفتر الأستاذ)',
                            children: (
                                                           
                                                                                                                                      
                                                                                      دفتر الحسابات الجاري الموحد للمبنى       
                                                               يتضمن المقبوضات والمصروفات حسب التسلسل التاريخي       
                                          
                                                                                                                                                                           `${record.type}-${record.id}`}
                                        columns={[
                                            { 
                                                title: 'التاريخ', 
                                                dataIndex: 'date', 
                                                key: 'date',
                                                render: (d) => (
                                                         
                                                             {dayjs(d).format('YYYY-MM-DD م')}      
                                                                                                   {toHijri(d)} هـ      
                                                          
                                                )
                                            },
                                            { title: 'رقم المستند / السند', dataIndex: 'refNumber', key: 'refNumber' },
                                            { 
                                                title: 'النوع', 
                                                dataIndex: 'type', 
                                                key: 'type',
                                                render: (type) => (
                                                                                                          
                                                        {type === 'receipt' ? 'سند قبض' : 'سند صرف'}
                                                          
                                                )
                                            },
                                            { title: 'التصنيف', dataIndex: 'category', key: 'category' },
                                            { title: 'طريقة الدفع', dataIndex: 'paymentMethod', key: 'paymentMethod' },
                                            { title: 'البيان والتفاصيل', dataIndex: 'description', key: 'description' },
                                            { 
                                                title: 'مقبوضات / إيرادات (+)', 
                                                dataIndex: 'income', 
                                                key: 'income',
                                                render: (v) => v > 0 ?                                              +{sarFormatter(v)}        : '-'
                                            },
                                            { 
                                                title: 'مدفوعات / مصروفات (-)', 
                                                dataIndex: 'expense', 
                                                key: 'expense',
                                                render: (v) => v > 0 ?                                          -{sarFormatter(v)}        : '-'
                                            },
                                            { 
                                                title: 'الرصيد الجاري للعمليات', 
                                                dataIndex: 'balance', 
                                                key: 'balance',
                                                render: (v) =>                                  = 0 ? 'text-primary' : 'text-red-700'}`}>{sarFormatter(v)}       
                                            },
                                            {
                                                title: 'إجراءات',
                                                key: 'action',
                                                render: (_, record) => (
                                                                                                                                                                                                                                                                              {
                                                            if (record.type === 'receipt') {
                                                                setActiveReceipt(record.rawItem);
                                                                setReceiptModalVisible(true);
                                                            } else {
                                                                const relatedUnit = units.find(u => u.id === record.rawItem.unit_id);
                                                                setActiveExpense({
                                                                    ...record.rawItem,
                                                                    building_name: building.name,
                                                                    unit_number: relatedUnit ? relatedUnit.unit_number : 'عام للمبنى',
                                                                    created_by_email: record.rawItem.created_by_email || ''
                                                                });
                                                                setExpensePreviewVisible(true);
                                                            }
                                                        }}
                                                    >
                                                        عرض السند
                                                             
                                                )
                                            }
                                        ]}
                                    />
                                      
                            )
                        },
                        {
                            key: '3',
                            label: 'سندات الصرف المصدرة (المصروفات)',
                            children: (
                                                           
                                                                                                                                      
                                                                                      سجل سندات صرف المصروفات       
                                                                                                                                                                                                                                  }
                                            onClick={() => handleOpenExpenseModal(null)}
                                        >
                                            إصدار سند صرف عام للمبنى
                                                 
                                          
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          units.find(u => u.id === uid)?.unit_number || 'عام للمبنى'
                                            },
                                            { 
                                                title: 'بند المصروف', 
                                                dataIndex: 'category', 
                                                key: 'category',
                                                render: (cat) => cat === 'Maintenance' ? 'صيانة' : cat === 'Utilities' ? 'خدمات' : 'أخرى'
                                            },
                                            { title: 'المبلغ المنصرف', dataIndex: 'amount', key: 'amount', render: v => sarFormatter(v) },
                                            { title: 'طريقة الدفع', dataIndex: 'payment_method', render: v => v === 'Bank Transfer' ? 'تحويل بنكي' : 'كاش' },
                                            { title: 'تاريخ الصرف', dataIndex: 'created_at', render: v => dayjs(v).format('YYYY-MM-DD HH:mm') },
                                            { title: 'البيان', dataIndex: 'description', key: 'description' },
                                            {
                                                title: 'حالة الاعتماد',
                                                dataIndex: 'approval_status',
                                                key: 'approval_status',
                                                render: (status, record) => {
                                                    let color = 'gold';
                                                    let text = 'في انتظار الاعتماد';
                                                    if (status === 'approved') {
                                                        color = 'green';
                                                        text = 'معتمد';
                                                    } else if (status === 'rejected') {
                                                        color = 'red';
                                                        text = 'مرفوض';
                                                    }
                                                    return (
                                                                                             
                                                                               {text}      
                                                            {record.approved_by && (
                                                                                                                    
                                                                    بواسطة: {record.approved_by}
                                                                       
                                                            )}
                                                                
                                                    );
                                                }
                                            },
                                            {
                                                title: 'إجراءات',
                                                key: 'actions',
                                                render: (_, record) => (
                                                           
                                                                                                        {
                                                            const relatedUnit = units.find(u => u.id === record.unit_id);
                                                            setActiveExpense({
                                                                ...record,
                                                                building_name: building.name,
                                                                unit_number: relatedUnit ? relatedUnit.unit_number : 'عام للمبنى',
                                                                created_by_email: record.created_by_email || ''
                                                            });
                                                            setExpensePreviewVisible(true);
                                                        }}>عرض وطباعة         
                                                        {(profile?.role === 'admin' && (!record.approval_status || record.approval_status === 'pending')) && (
                                                            <>
                                                                                                                                                                                  handleApproveExpense(record)}>اعتماد         
                                                                                                                                                 handleRejectExpense(record)}>رفض         
                                                               
                                                        )}
                                                        {(profile?.role === 'admin') && (
                                                                                                                   handleDeleteExpense(record)}>حذف         
                                                        )}
                                                            
                                                )
                                            }
                                        ]}
                                    />
                                      
                            )
                        }
                    ]} />

                    {/* Unit Form Modal */}
                                                                                                                                                                                                                      setIsModalOpen(false)}
                        onOk={() => form.submit()}
                        width={720}
                    >
                                                                                                                      
                                                         بيانات الوحدة والمستأجر          
                                             
                                               
                                                                                                                  
                                                 
                                                
                                      
                                               
                                                                                                             
                                                  مؤجرة           
                                                
                                      
                                  

                                                                                            prevValues.is_rented !== currentValues.is_rented}>
                                {({ getFieldValue }) => getFieldValue('is_rented') && (
                                    <>
                                                         
                                                           
                                                                                                                                
                                                             
                                                            
                                                  
                                                           
                                                                                                                            
                                                             
                                                            
                                                  
                                              
                                                         
                                                           
                                                                                                  
                                                             
                                                            
                                                  
                                                           
                                                                                                                                 
                                                             
                                                            
                                                  
                                              

                                                                     فترة العقد وقيمته          
                                                         
                                                           
                                                                                                                              
                                                                                                 
                                                            
                                                                      
                                                    {liveStartDate &&                              بداية العقد بالهجري: {toHijri(liveStartDate)}       }
                                                    {liveEndDate &&                              نهاية العقد بالهجري: {toHijri(liveEndDate)}       }
                                                      
                                                  
                                              
                                                         
                                                           
                                                                                                                                                  
                                                                                              
                                                            
                                                  
                                                           
                                                {selectedUnit && (
                                                                                                                            
                                                                          
                                                                           
                                                                                                       المحصل سابقاً      
                                                                {profile?.role === 'admin' ? (
                                                                                                                                                                                                                                                                                                                                                                                                             showReceiptHistory(selectedUnit)}
                                                                    >
                                                                        {sarFormatter(selectedUnit.amount_paid || 0)}
                                                                             
                                                                ) : (
                                                                                                                {sarFormatter(selectedUnit.amount_paid || 0)}      
                                                                )}
                                                                  
                                                                           
                                                                                                       المتبقي من العقد      
                                                                                                        
                                                                    {sarFormatter(Math.max(0, (getFieldValue('monthly_rent') || 0) - (selectedUnit.amount_paid || 0)))}
                                                                      
                                                                  
                                                              
                                                          
                                                )}
                                                  
                                              

                                                                     عملية تحصيل الدفعة          
                                                         
                                                           
                                                                                                                                              
                                                                                              
                                                            
                                                  
                                                           
                                                                                                                                                      
                                                                                                                                                                                                                                                                                                                                        
                                                            
                                                  
                                              
                                       
                                )}
                                        
                               
                            

                    {/* Issue Expense Voucher Modal */}
                                                                                                                                
                                                                            
                                      {selectedUnit ? `إصدار سند صرف للوحدة: ${selectedUnit.unit_number}` : 'إصدار سند صرف عام للمبنى'}       
                                  
                        }
                        open={expenseModalOpen}
                        onCancel={() => { setExpenseModalOpen(false); setBalanceWarning(''); setShowCustomCategory(false); }}
                        onOk={() => expenseForm.submit()}
                        width={680}
                        okText="حفظ السند واعتماده"
                        okButtonProps={{ danger: true, disabled: !!balanceWarning }}
                        cancelText="إلغاء"
                    >
                                                                                                                                                                                                                                                                                                                                                               
                            {/* Voucher Number + Category */}
                                             
                                               
                                                                        
                                                                                                                         
                                                
                                      
                                               
                                                                                                                                                      
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   
                                                
                                      
                                  

                            {/* Custom Category Text Input */}
                            {showCustomCategory && (
                                                                                                                                                                                                                                                                                                                         
                                                                                                                                                    
                                            
                            )}

                            {/* Amount + Payment Method */}
                                             
                                               
                                                                                                                                                       
                                                                                                   
                                                
                                      
                                               
                                                                                                                      
                                                                                                                                                                                                                                                                                                                      
                                                
                                      
                                  

                            {/* Balance Warning */}
                            {balanceWarning && (
                                                                                                                            
                                                                                  ⚠️       
                                                                                        {balanceWarning}    
                                      
                            )}

                            {/* Description */}
                                                                                                                                                               
                                                                                                                  
                                        

                            {/* Manager Approval Section (Only for Admin) */}
                            {profile?.role === 'admin' && (
                                                                                                         
                                                                                                                   
                                              🔏        اعتماد المسؤول عن الصرف
                                          
                                                                                                                                                                                                                                                                                                                                           
                                                                                                                                              }
                                            placeholder="مثال: خالد العتيبي — مدير العقار"
                                            className="border-amber-300 focus:border-amber-500"
                                        />
                                                
                                                                                                                                                                                                                                                        v ? Promise.resolve() : Promise.reject('يجب تأكيد الاعتماد') }]}
                                    >
                                                                                           
                                            أوافق وأعتمد صرف هذا المبلغ وأتحمل مسؤوليته كاملاً
                                                   
                                                
                                      
                            )}
                               
                            

                    {/* Unit Profile & Detail Drawer */}
                                                                                                                                                                                                setUnitProfileOpen(false)}
                        open={unitProfileOpen}
                        width="60%"
                    >
                                                   
                            {/* Current Lease Details */}
                            {selectedUnit?.is_rented ? (
                                                                                                                                                                                    
                                                                                   
                                                                                     {selectedUnit.tenant_name}                    
                                                                              {selectedUnit.id_number}                    
                                                                              {selectedUnit.phone_number || '-'}                    
                                                                                      {selectedUnit.contract_number}                    
                                                                               
                                                 {selectedUnit.period_start} م      
                                                                                       {toHijri(selectedUnit.period_start)} هـ      
                                                            
                                                                               
                                                 {selectedUnit.period_end} م      
                                                                                       {toHijri(selectedUnit.period_end)} هـ      
                                                            
                                                                              {sarFormatter(selectedUnit.monthly_rent || 0)}                    
                                                                          {sarFormatter(selectedUnit.amount_paid || 0)}                    
                                                                           
                                                                                                                                  0 ? 'text-red-500 font-bold' : 'text-emerald-600 font-bold'}>
                                                {sarFormatter(Math.max(0, (selectedUnit.monthly_rent || 0) - (selectedUnit.amount_paid || 0)))}
                                                   
                                                            
                                                                               {selectedUnit.payment_method === 'Bank Transfer' ? 'تحويل بنكي' : 'كاش'}                    
                                                   
                                       
                            ) : (
                                                                                                           
                                                                                              
                                       
                            )}

                            {/* Lifecycle Expiration Actions Banner */}
                            {selectedUnit?.is_rented && isLeaseExpired(selectedUnit?.period_end) && (
                                                                                                                                                 
                                                                                             ⚠️ العقد الحالي منتهي الصلاحية      
                                                                                 انتهت فترة عقد الإيجار لهذه الوحدة بتاريخ {selectedUnit?.period_end} م. يرجى اتخاذ قرار بالتجديد أو إنهاء العقد وتفريغ الوحدة.      
                                           
                                                                                                                                                         {
                                            renewalForm.resetFields();
                                            renewalForm.setFieldsValue({
                                                tenant_name: selectedUnit?.tenant_name,
                                                id_number: selectedUnit?.id_number,
                                                phone_number: selectedUnit?.phone_number,
                                                payment_method: 'Cash',
                                                amount_received: 0,
                                                new_rent_value: selectedUnit?.monthly_rent
                                            });
                                            setRenewalLiveStartDate(null);
                                            setRenewalLiveEndDate(null);
                                            setSettlementAction(null);
                                            setNewRentValue(selectedUnit?.monthly_rent || 0);
                                            setRenewalModalOpen(true);
                                        }}>تجديد العقد (Renew)         
                                                                                                               handleTerminateContract(selectedUnit)}>إنهاء العقد (Terminate)         
                                            
                                      
                            )}

                            {/* Accordion / Collapse for Lease History Archive & Receipts */}
                                                                                    
                                                                                                 📜 سجل العقود والأرشيف (Lease History Archive)       } key="1">
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            (
                                                                             
                                                             من: {r.period_start}      
                                                             إلى: {r.period_end}      
                                                          
                                                )
                                            },
                                            { title: 'القيمة', dataIndex: 'monthly_rent', render: v => sarFormatter(v) },
                                            { title: 'المحصل', dataIndex: 'amount_paid', render: v => sarFormatter(v) },
                                            { 
                                                title: 'حالة التسوية', 
                                                dataIndex: 'settlement_status', 
                                                key: 'settlement_status',
                                                render: (status) => {
                                                    if (status === 'Settled') return                      تسوية كاش      ;
                                                    if (status === 'Rolled_Over') return                      ترحيل دين      ;
                                                    return '-';
                                                }
                                            },
                                            { 
                                                title: 'الدين المرحّل', 
                                                dataIndex: 'final_carried_debt_amount', 
                                                render: v => v ? sarFormatter(v) : '-' 
                                            },
                                            { title: 'تاريخ الأرشفة', dataIndex: 'archived_at', render: v => dayjs(v).format('YYYY-MM-DD') }
                                        ]}
                                    />
                                                 
                                {selectedUnit?.is_rented && (
                                                                                                     💵 سجل سندات القبض للوحدة       } key="2">
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               sarFormatter(v) },
                                                { title: 'طريقة الدفع', dataIndex: 'payment_method', render: v => v === 'Bank Transfer' ? 'تحويل بنكي' : 'كاش' },
                                                { title: 'تاريخ التحصيل', dataIndex: 'created_at', render: v => dayjs(v).format('YYYY-MM-DD') },
                                                {
                                                    title: 'إجراءات',
                                                    key: 'actions',
                                                    render: (_, record) => (
                                                               
                                                                                                            {
                                                                setActiveReceipt(record);
                                                                setReceiptModalVisible(true);
                                                            }}>عرض السند         
                                                            {profile?.role === 'admin' && (
                                                                <>
                                                                                                                                                                  handleEditReceiptAmount(record)}>تعديل المبلغ         
                                                                                                                           handleDeleteReceipt(record)}>حذف         
                                                                   
                                                            )}
                                                                
                                                    )
                                                }
                                            ]}
                                        />
                                                     
                                )}
                                       
                              
                             

                    {/* Contract Renewal Modal */}
                                                                                                                                                                                                            setRenewalModalOpen(false)}
                        onOk={() => renewalForm.submit()}
                        width={720}
                    >
                                                                                                                                                                                                                                                                   {
                                if (changedValues.rent_period) {
                                    const [start, end] = changedValues.rent_period || [null, null];
                                    setRenewalLiveStartDate(start ? start.toDate() : null);
                                    setRenewalLiveEndDate(end ? end.toDate() : null);
                                }
                                if (changedValues.settlement_action !== undefined) {
                                    setSettlementAction(changedValues.settlement_action);
                                }
                                if (changedValues.new_rent_value !== undefined) {
                                    setNewRentValue(changedValues.new_rent_value || 0);
                                }
                            }}
                        >
                            {(() => {
                                const oldRemaining = selectedUnit ? (selectedUnit.monthly_rent || 0) - (selectedUnit.amount_paid || 0) : 0;
                                return oldRemaining > 0 ? (
                                                                                                                            
                                                                                
                                            تنبيه: يوجد مبلّغ متبقي غير محصل من العقد القديم بقيمة: {sarFormatter(oldRemaining)} ر.س. يرجى اختيار الإجراء المالي المناسب لإتمام التجديد.
                                              
                                                                                                                                                                                                             الإجراء المالي للمتبقي من العقد القديم       } 
                                            rules={[{ required: true, message: 'يرجى اختيار الإجراء المالي للمتابعة' }]}
                                        >
                                                                                         
                                                                                          
                                                            تسوية المبلغ (Cash Settlement)          - سداد وإغلاق المتبقي من العقد القديم كدفعة نهائية.
                                                        
                                                                                            
                                                            ترحيل وإضافة على العقد الجديد (Balance Rollover)          - ترحيل المتبقي وإضافته لمديونية العقد الجديد.
                                                        
                                                          
                                                    

                                        {/* Option A: Cash Settlement Fields */}
                                        {settlementAction === 'settle' && (
                                                                                                                 
                                                                 
                                                                   
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      
                                                                                                      
                                                                    
                                                          
                                                                   
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        
                                                                                                                                                                                                                                                                                                                                                                                        
                                                                    
                                                          
                                                      
                                                  
                                        )}

                                        {/* Option B: Rollover Financial Card */}
                                        {settlementAction === 'rollover' && (
                                                                                                                 
                                                                                                  
                                                                                          
                                                              قيمة الإيجار الأساسية للعقد الجديد:       
                                                                {sarFormatter(newRentValue || 0)}         
                                                          
                                                                                                       
                                                              المتأخرات المرحّلة من العقد القديم (+):       
                                                                {sarFormatter(oldRemaining)}         
                                                          
                                                                                                 
                                                                                                                           
                                                              إجمالي القيمة المستهدفة الجديدة:       
                                                              {sarFormatter((newRentValue || 0) + oldRemaining)}       
                                                          
                                                      
                                                   
                                        )}
                                          
                                ) : null;
                            })()}

                                                         بيانات المستأجر          
                                             
                                               
                                                                                                                    
                                                 
                                                
                                      
                                               
                                                                                                                
                                                 
                                                
                                      
                                  
                                             
                                               
                                                                                      
                                                 
                                                
                                      
                                  

                                                         العقد الجديد والقيمة          
                                             
                                               
                                                                                                                                
                                                 
                                                
                                      
                                               
                                                                                                                                        
                                                                                  
                                                
                                      
                                  
                                             
                                               
                                                                                                                         
                                                                                     
                                                
                                                          
                                        {renewalLiveStartDate &&                                    بداية العقد الجديد بالهجري: {toHijri(renewalLiveStartDate)} هـ       }
                                        {renewalLiveEndDate &&                                    نهاية العقد الجديد بالهجري: {toHijri(renewalLiveEndDate)} هـ       }
                                          
                                      
                                  

                                                         تحصيل الدفعة الأولى للتجديد          
                                             
                                               
                                                                                                                               
                                                                                  
                                                
                                      
                                               
                                                                                                                      
                                                                                                                                                                                                                                                                                                        
                                                
                                      
                                  
                               
                            

                    {/* Global Receipt Modal */}
                                                                                                                                                                               setReceiptModalVisible(false)}
                    />

                    {/* Global Expense Voucher Modal */}
                                                                                                                                                                                        setExpensePreviewVisible(false)}
                    />
                         
            );
        };


        const AdminPanel = ({ users, onUpdateUser, cities, allBuildings }) => {
            const [isModalOpen, setIsModalOpen] = useState(false);
            const [selectedUser, setSelectedUser] = useState(null);
            const [form] = Form.useForm();

            const handleSaveUser = async (values) => {
                const processedEmail = processUsername(values.email);
                if (selectedUser) {
                    // Strip out non-profile fields before sending to DB
                    const { new_password, password, email, ...profileUpdates } = values;
                    await onUpdateUser(selectedUser.id, profileUpdates);
                    setIsModalOpen(false);
                    setSelectedUser(null);
                    form.resetFields();
                    return;
                }
                
                try {
                    // Check if user already exists in profiles
                    const { data: existingUser } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('email', processedEmail)
                        .maybeSingle();

                    if (existingUser) {
                        Modal.confirm({
                            title: 'المستخدم موجود بالفعل',
                            content: 'هذا المستخدم مسجل مسبقاً. هل تريد تحديث صلاحياته بالبيانات الجديدة؟',
                            okText: 'تحديث',
                            cancelText: 'إلغاء',
                            onOk: async () => {
                                await onUpdateUser(existingUser.id, {
                                    role: values.role || 'user',
                                    can_add: values.can_add || false,
                                    can_edit: values.can_edit || false,
                                    can_delete: values.can_delete || false,
                                    can_report: values.can_report || false,
                                    assigned_buildings: values.assigned_buildings || []
                                });
                                setIsModalOpen(false);
                                form.resetFields();
                            }
                        });
                        return;
                    }

                    const tempClient = libSupabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
                        auth: { persistSession: false }
                    });

                    const { data: authData, error: authError } = await tempClient.auth.signUp({
                        email: processedEmail,
                        password: values.password,
                    });

                    if (authError) throw authError;

                    if (authData.user) {
                        const { error: profileError } = await supabase
                            .from('profiles')
                            .upsert([{
                                id: authData.user.id,
                                email: processedEmail,
                                role: values.role || 'user',
                                can_add: values.can_add || false,
                                can_edit: values.can_edit || false,
                                can_delete: values.can_delete || false,
                                can_report: values.can_report || false,
                                assigned_buildings: values.assigned_buildings || []
                            }], { onConflict: 'id' });

                        if (profileError) throw profileError;

                        message.success("تم إنشاء المستخدم وتفعيل صلاحياته بنجاح.");
                        setIsModalOpen(false);
                        form.resetFields();
                    }
                } catch (error) {
                    if (error.message.includes('rate limit')) {
                        message.error({
                            content: "خطأ: تم تجاوز حد إرسال رسائل البريد الإلكتروني. يرجى تعطيل 'Confirm Email' في إعدادات Supabase (Authentication > Settings).",
                            duration: 10
                        });
                    } else {
                        message.error("خطأ في إنشاء المستخدم: " + error.message);
                    }
                }
            };
            const handleDeleteUser = async (userId) => {
                const { error } = await supabase.rpc('admin_delete_user', { target_user_id: userId });
                if (error) message.error("خطأ في الحذف: " + error.message);
                else {
                    message.success("تم حذف المستخدم بنجاح");
                    // Data will refresh via realtime subscription in App
                }
            };

            const handleUpdatePassword = async (userId, newPassword) => {
                const { error } = await supabase.rpc('admin_update_user_password', {
                    target_user_id: userId,
                    new_password: newPassword
                });
                if (error) message.error("خطأ في تحديث كلمة المرور: " + error.message);
                else message.success("تم تحديث كلمة المرور بنجاح");
            };
            const PermissionToggle = ({ field, record }) => (
                                                                                                           onUpdateUser(record.id, { [field]: e.target.checked })}
                />
            );

            return (
                                           
                                                                                                         
                                                           إدارة المستخدمين والصلاحيات        
                                                                     } onClick={() => { setSelectedUser(null); form.resetFields(); setIsModalOpen(true); }}>دعوة مستخدم جديد         
                          

                                                
                                                                                                                                                                                                                                                                                                                                    displayUsername(v) },
                                {
                                    title: 'الدور',
                                    dataIndex: 'role',
                                    key: 'role',
                                    render: (role, record) => (
                                                                                                                                                                        onUpdateUser(record.id, { role: val })}
                                            options={[{ label: 'مسؤول', value: 'admin' }, { label: 'مستخدم', value: 'user' }]}
                                        />
                                    )
                                },
                                { title: 'إضافة', key: 'can_add', render: (_, r) =>                                                 },
                                { title: 'تعديل', key: 'can_edit', render: (_, r) =>                                                  },
                                { title: 'حذف', key: 'can_delete', render: (_, r) =>                                                    },
                                { title: 'تقارير', key: 'can_report', render: (_, r) =>                                                    },
                                {
                                    title: 'العمارات المخصصة',
                                    key: 'assigned_buildings',
                                    width: 150,
                                    render: (_, record) => {
                                        const count = (record.assigned_buildings || []).length;
                                        return record.role === 'admin'
                                            ?                    جميع العمارات      
                                            :                     0 ? 'blue' : 'red'}>{count > 0 ? `${count} عمارة` : 'لم يتم التخصيص'}      ;
                                    }
                                },
                                {
                                    title: 'إجراءات',
                                    key: 'actions',
                                    fixed: 'right',
                                    width: 150,
                                    render: (_, record) => (
                                               
                                                                                                                          }
                                                size="small"
                                                onClick={() => {
                                                    setSelectedUser(record);
                                                    form.setFieldsValue(record);
                                                    setIsModalOpen(true);
                                                }}
                                                title="تعديل المستخدم"
                                            />
                                                                                                                          }
                                                size="small"
                                                onClick={() => {
                                                    const newPass = prompt("أدخل كلمة المرور الجديدة للمستخدم:");
                                                    if (newPass && newPass.length >= 6) {
                                                        handleUpdatePassword(record.id, newPass);
                                                    } else if (newPass) {
                                                        message.warning("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
                                                    }
                                                }}
                                                title="تغيير كلمة المرور"
                                            />
                                                                                                                                                                                                                                                                                             handleDeleteUser(record.id)}
                                                okText="نعم"
                                                cancelText="لا"
                                                okButtonProps={{ danger: true }}
                                            >
                                                                                                                                                                                               }
                                                    size="small"
                                                    title="حذف المستخدم"
                                                />
                                                         
                                                
                                    )
                                }
                            ]}
                        />
                           

                                                                                                                                                                                                          { setIsModalOpen(false); setSelectedUser(null); }}
                        onOk={() => form.submit()}
                        okText={selectedUser ? "حفظ التغييرات" : "إرسال الدعوة"}
                        cancelText="إلغاء"
                    >
                                                                                        {
                            if (selectedUser) {
                                // If password provided, update it first
                                if (values.new_password) {
                                    await handleUpdatePassword(selectedUser.id, values.new_password);
                                }
                                // Update profile data
                                await handleSaveUser(values);
                            } else {
                                await handleSaveUser(values);
                            }
                        }}>
                                                                                                      
                                                                                              
                                        
                            
                                                                                                                                                                                                                                                                                                                                              
                                                                                                                                                  
                                        

                                                                                     
                                                                                                                             
                                        
                            
                                                             
                                                                                                    إضافة                       
                                                                                                     تعديل                       
                                                                                                       حذف                       
                                                                                                       تقارير                       
                                  

                                                                                                                                   
                                                                                                                                                                                                                                                                                                                                                                                                                         
                                    {cities.map(city => {
                                        const cityBuildings = (allBuildings || []).filter(b => b.city_id === city.id);
                                        if (cityBuildings.length === 0) return null;
                                        return (
                                                                                                                                         
                                                {cityBuildings.map(b => (
                                                                                                                                 
                                                        {b.name}
                                                                    
                                                ))}
                                                              
                                        );
                                    })}
                                         
                                        
                                                  
                                {cities.map(city => {
                                    const cityBuildings = (allBuildings || []).filter(b => b.city_id === city.id);
                                    if (cityBuildings.length === 0) return null;
                                    return (
                                                                                                                                                                                                                                                                                                                                                          {
                                                const current = form.getFieldValue('assigned_buildings') || [];
                                                const cityBIds = cityBuildings.map(b => b.id);
                                                const allSelected = cityBIds.every(id => current.includes(id));
                                                if (allSelected) {
                                                    form.setFieldsValue({ assigned_buildings: current.filter(id => !cityBIds.includes(id)) });
                                                } else {
                                                    const merged = [...new Set([...current, ...cityBIds])];
                                                    form.setFieldsValue({ assigned_buildings: merged });
                                                }
                                            }}
                                        >
                                            تحديد/إلغاء كل عمارات {city.name_ar}
                                                 
                                    );
                                })}
                                  

                            {selectedUser &&                                               اسم المستخدم: {displayUsername(selectedUser.email)}       }
                            {!selectedUser &&                        ملاحظة: سيتم تطبيق هذه الصلاحيات فور إنشاء المستخدم لحسابه.       }
                               
                            
                      
            );
        };
                               const SystemLogsView = ({ profile }) => {
            const [logs, setLogs] = useState([]);
            const [loading, setLoading] = useState(false);
            const [searchText, setSearchText] = useState('');
            const [actionFilter, setActionFilter] = useState('all');
            const [moduleFilter, setModuleFilter] = useState('all');

            const fetchLogs = async () => {
                setLoading(true);
                try {
                    const { data, error } = await supabase
                        .from('system_logs')
                        .select('*')
                        .order('created_at', { ascending: false });
                    if (error) throw error;
                    setLogs(data || []);
                } catch (e) {
                    message.error("خطأ في تحميل سجل العمليات: " + e.message);
                } finally {
                    setLoading(false);
                }
            };

            useEffect(() => {
                fetchLogs();
            }, []);

            const filteredLogs = useMemo(() => {
                return logs.filter(l => {
                    const matchesSearch = !searchText || 
                        l.user_email?.toLowerCase().includes(searchText.toLowerCase()) ||
                        l.description?.toLowerCase().includes(searchText.toLowerCase());
                    const matchesAction = actionFilter === 'all' || l.action_type === actionFilter;
                    const matchesModule = moduleFilter === 'all' || l.target_module === moduleFilter;
                    return matchesSearch && matchesAction && matchesModule;
                });
            }, [logs, searchText, actionFilter, moduleFilter]);

            const exportLogsToCSV = () => {
                try {
                    const headers = ['تاريخ العملية', 'المستخدم', 'نوع العملية', 'القسم/الجدول', 'معرف السجل', 'التفاصيل'];
                    const rows = filteredLogs.map(l => [
                        dayjs(l.created_at).format('YYYY-MM-DD HH:mm:ss'),
                        l.user_email,
                        l.action_type,
                        l.target_module,
                        l.record_id || '',
                        l.description
                    ]);

                    let csvContent = "\ufeff"; // BOM for UTF-8 Excel support
                    csvContent += headers.join(",") + "\n";
                    rows.forEach(row => {
                        const escapedRow = row.map(val => {
                            let cleanVal = String(val).replace(/"/g, '""');
                            if (cleanVal.includes(',') || cleanVal.includes('\n') || cleanVal.includes('"')) {
                                cleanVal = `"${cleanVal}"`;
                            }
                            return cleanVal;
                        });
                        csvContent += escapedRow.join(",") + "\n";
                    });

                    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                    const link = document.createElement("a");
                    const url = URL.createObjectURL(blob);
                    link.setAttribute("href", url);
                    link.setAttribute("download", `System_Audit_Logs_${dayjs().format('YYYY-MM-DD')}.csv`);
                    link.style.visibility = 'hidden';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    message.success("تم تصدير سجل العمليات إلى CSV بنجاح");
                } catch (err) {
                    message.error("فشل تصدير سجل العمليات: " + err.message);
                }
            };

            const columns = [
                {
                    title: 'تاريخ العملية',
                    dataIndex: 'created_at',
                    key: 'created_at',
                    render: (text) => (
                             
                                 {dayjs(text).format('YYYY-MM-DD HH:mm:ss')}      
                                                                                {toHijri(text)}      
                              
                    ),
                    width: 170
                },
                {
                    title: 'المستخدم',
                    dataIndex: 'user_email',
                    key: 'user_email',
                    render: (text) =>              {text || 'غير معروف'}       ,
                    width: 200
                },
                {
                    title: 'نوع العملية',
                    dataIndex: 'action_type',
                    key: 'action_type',
                    render: (type) => {
                        let color = 'default';
                        if (type === 'INSERT') color = 'green';
                        if (type === 'UPDATE') color = 'blue';
                        if (type === 'DELETE') color = 'volcano';
                        if (type === 'LOGIN') color = 'purple';
                        if (type === 'RENEWAL') color = 'cyan';
                        return                    {type}      ;
                    },
                    width: 100
                },
                {
                    title: 'القسم/الجدول',
                    dataIndex: 'target_module',
                    key: 'target_module',
                    render: (mod) =>                     {mod}      ,
                    width: 130
                },
                {
                    title: 'التفاصيل والوصف بالكامل',
                    dataIndex: 'description',
                    key: 'description'
                }
            ];

            return (
                                           
                                                
                                                                                
                                 
                                                 سجل العمليات والمراقبة العام (Audit Trail)        
                                                       تتبع ومراقبة جميع العمليات المالية والإدارية التي تمت على النظام بالتفصيل.       
                                  
                                                        
                                                                                                           }>
                                    تصدير إلى CSV
                                         
                                                                                                      }>
                                    تحديث
                                         
                                  
                              

                                                                   
                                                               
                                                                              البحث في السجلات       
                                                                                                                                                                                                                                          setSearchText(e.target.value)} 
                                    allowClear 
                                />
                                  
                                                            
                                                                              نوع العملية       
                                                                                                           
                                                               الكل                
                                                                  INSERT (إضافة)                
                                                                  UPDATE (تعديل)                
                                                                  DELETE (حذف)                
                                                                 LOGIN (دخول)                
                                                                   RENEWAL (تجديد)                
                                         
                                  
                                                            
                                                                              القسم       
                                                                                                           
                                                               الكل                
                                                                       REAL_ESTATE (العقارات)                
                                                                 UNITS (الوحدات)                
                                                                    RECEIPTS (سندات القبض)                
                                                                    EXPENSES (سندات الصرف)                
                                                                     CONTRACTS (العقود)                
                                         
                                  
                              

                                                                                                                                                                                                                                                                                                                                                                              
                           
                      
            );
        };

        const Reporting = ({ profile, cities }) => {
            const [form] = Form.useForm();
            const [loading, setLoading] = useState(false);
            const [buildings, setBuildings] = useState([]);
            const [calendarMode, setCalendarMode] = useState('Gregorian'); // Gregorian or Hijri

            useEffect(() => {
                const fetchBuildingsForUser = async () => {
                    const { data } = await supabase
                        .from('buildings')
                        .select('*');
                    
                    const assignedBIds = getAssignedBuildingIds(profile);
                    const filtered = assignedBIds === null ? (data || []) : (data || []).filter(b => assignedBIds.includes(b.id));
                    setBuildings(filtered);
                };
                fetchBuildingsForUser();
            }, [profile]);

            const filteredCities = useMemo(() => {
                if (profile?.role === 'admin') return cities;
                return cities.filter(c => buildings.some(b => b.city_id === c.id));
            }, [cities, buildings, profile]);

            const generateExcel = async (values) => {
                setLoading(true);
                try {
                    let query = supabase.from('units').select('*, buildings(*)');

                    if (values.buildings && values.buildings.length > 0) {
                        query = query.in('building_id', values.buildings);
                    } else if (values.cities && values.cities.length > 0) {
                        const { data: bData } = await supabase.from('buildings').select('id').in('city_id', values.cities);
                        const cityBuildings = bData?.map(b => b.id) || [];
                        if (cityBuildings.length > 0) query = query.in('building_id', cityBuildings);
                    } else {
                        const authCities = filteredCities.map(c => c.id);
                        const { data: bData } = await supabase.from('buildings').select('id').in('city_id', authCities);
                        const authCityBuildings = bData?.map(b => b.id) || [];
                        if (authCityBuildings.length > 0) query = query.in('building_id', authCityBuildings);
                    }

                    const { data, error } = await query;
                    if (error) throw error;

                    const assignedBIds = getAssignedBuildingIds(profile);
                    let filteredData = data || [];
                    if (assignedBIds !== null) {
                        filteredData = filteredData.filter(u => assignedBIds.includes(u.building_id));
                    }
                    if (calendarMode === 'Gregorian' && values.dates) {
                        const [start, end] = values.dates;
                        filteredData = data.filter(u => {
                            const date = dayjs(u.updated_at);
                            return date.isAfter(start) && date.isBefore(end);
                        });
                    } else if (calendarMode === 'Hijri' && values.hijri_year) {
                        const { startDate, endDate } = getGregorianRangeForHijriMonth(
                            values.hijri_year, 
                            values.hijri_month === 'all' ? null : parseInt(values.hijri_month, 10)
                        );
                        if (startDate && endDate) {
                            filteredData = data.filter(u => {
                                const date = new Date(u.updated_at);
                                return date >= startDate && date                                                                                                                                                              ({
                        'المدينة': cities.find(c => c.id === u.buildings?.city_id)?.name_ar || '-',
                        'المبنى': u.buildings?.name || '-',
                        'رقم الوحدة': u.unit_number,
                        'رقم العقد': u.contract_number || '-',
                        'المستأجر': u.tenant_name || '-',
                        'رقم الهوية': u.id_number || '-',
                        'قيمة العقد المتوقعة': u.monthly_rent,
                        'المبلغ المدفوع': u.amount_paid,
                        'المتبقى': (u.monthly_rent || 0) - (u.amount_paid || 0),
                        'طريقة الدفع': u.payment_method === 'Bank Transfer' ? 'تحويل بنكي' : 'كاش',
                        'الحالة': u.is_rented ? 'مؤجرة' : 'شاغرة',
                        'تاريخ التحديث': dayjs(u.updated_at).format('YYYY-MM-DD'),
                        'تاريخ التحديث (هجري)': toHijri(u.updated_at)
                    }));

                    const ws = XLSX.utils.json_to_sheet(worksheetData);
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, "تقرير تحصيل الإيجارات");

                    // Generate Excel file
                    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
                    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

                    // Robust download method
                    const fileName = `Rent_Portal_Report_${dayjs().format('YYYY-MM-DD')}.xlsx`;
                    if (window.navigator && window.navigator.msSaveOrOpenBlob) {
                        window.navigator.msSaveOrOpenBlob(blob, fileName);
                    } else {
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        document.body.appendChild(a);
                        a.style = 'display: none';
                        a.href = url;
                        a.download = fileName;
                        a.click();
                        window.URL.revokeObjectURL(url);
                        document.body.removeChild(a);
                    }

                    message.success("تم توليد ملف Excel بنجاح");
                } catch (error) {
                    message.error("خطأ في توليد التقرير: " + error.message);
                } finally {
                    setLoading(false);
                }
            };

            const isSuperAdmin = profile?.email === 'khalednasr007@gmail.com';

            if (!profile?.can_report && profile?.role !== 'admin' && !isSuperAdmin) {
                return (
                                                                           
                                                                                                                       
                          
                );
            }

            const tabItems = [
                {
                    key: 'excel',
                    label: 'تقارير Excel والبحث المتقدم',
                    children: (
                                                    
                                             محرك التقارير والبحث المتقدم        
                                                                          قم بتصفية البيانات المطلوبة بناءً على التاريخ الهجري أو الميلادي وتوليد تقرير Excel شامل.       

                                                                                                                                
                                                 
                                                        
                                                                        
                                                                                                                                                                                                    setCalendarMode(e.target.value)}
                                                className="w-full"
                                            >
                                                                                                                   ميلادي (Gregorian)                    
                                                                                                               هجري (Hijri)                    
                                                               
                                                    
                                          
                                    
                                    {calendarMode === 'Gregorian' ? (
                                                             
                                                                                          
                                                                                             
                                                        
                                              
                                    ) : (
                                        <>
                                                                
                                                                                                                                                                        
                                                                                             
                                                        {[1445, 1446, 1447, 1448, 1449, 1450].map(y => (
                                                                                             {y} هـ                
                                                        ))}
                                                             
                                                            
                                                  
                                                                
                                                                                                   
                                                            
                                                                                   كل الأشهر                
                                                        {[
                                                            { val: 1, label: '1 - محرم' },
                                                            { val: 2, label: '2 - صفر' },
                                                            { val: 3, label: '3 - ربيع الأول' },
                                                            { val: 4, label: '4 - ربيع الثاني' },
                                                            { val: 5, label: '5 - جمادى الأولى' },
                                                            { val: 6, label: '6 - جمادى الآخرة' },
                                                            { val: 7, label: '7 - رجب' },
                                                            { val: 8, label: '8 - شعبان' },
                                                            { val: 9, label: '9 - رمضان' },
                                                            { val: 10, label: '10 - شوال' },
                                                            { val: 11, label: '11 - ذو القعدة' },
                                                            { val: 12, label: '12 - ذو الحجة' }
                                                        ].map(m => (
                                                                                                     {m.label}                
                                                        ))}
                                                             
                                                            
                                                  
                                           
                                    )}
                                      
                                
                                                 
                                                         
                                                                                    
                                                                                                                    
                                                {buildings.map(b =>                                        {b.name}                )}
                                                     
                                                    
                                          
                                                                                         
                                                                                         } htmlType="submit" loading={loading} block size="large">
                                            توليد تقرير Excel
                                                 
                                          
                                      
                                   
                               
                    )
                }
            ];

            if (isSuperAdmin) {
                tabItems.push({
                    key: 'audit',
                    label: 'سجل العمليات والمراقبة (Audit Trail)',
                    children:                                     
                });
            }

            return (
                                           
                                                                           
                      
            );
        };

        const VouchersLedger = ({ profile, cities }) => {
            const [receipts, setReceipts] = useState([]);
            const [expenses, setExpenses] = useState([]);
            const [buildings, setBuildings] = useState([]);
            const [units, setUnits] = useState([]);
            const [loading, setLoading] = useState(true);

            // Filter states
            const [selectedCity, setSelectedCity] = useState(null);
            const [selectedBuilding, setSelectedBuilding] = useState(null);
            const [selectedUnit, setSelectedUnit] = useState(null);
            const [voucherType, setVoucherType] = useState('all');
            const [searchText, setSearchText] = useState('');

            // Date filtering states
            const [calendarMode, setCalendarMode] = useState('Gregorian'); // Gregorian or Hijri
            const [gregorianRange, setGregorianRange] = useState(null);
            const [hijriYear, setHijriYear] = useState(null);
            const [hijriMonth, setHijriMonth] = useState('all');

            // Modal states for details & printing
            const [activeReceipt, setActiveReceipt] = useState(null);
            const [receiptModalVisible, setReceiptModalVisible] = useState(false);
            const [activeExpense, setActiveExpense] = useState(null);
            const [expensePreviewVisible, setExpensePreviewVisible] = useState(false);
            const [printOnLoad, setPrintOnLoad] = useState(false);

            const fetchData = useCallback(async () => {
                setLoading(true);
                try {
                    const [rRes, eRes, bRes, uRes] = await Promise.all([
                        supabase.from('receipts').select('*').order('created_at', { ascending: false }),
                        supabase.from('vouchers_expense').select('*').order('created_at', { ascending: false }),
                        supabase.from('buildings').select('*'),
                        supabase.from('units').select('*')
                    ]);
                    
                    if (rRes.error) throw rRes.error;
                    if (eRes.error) throw eRes.error;
                    if (bRes.error) throw bRes.error;
                    if (uRes.error) throw uRes.error;

                    const assignedBIds = getAssignedBuildingIds(profile);

                    const filteredBuildings = assignedBIds === null ? (bRes.data || []) : (bRes.data || []).filter(b => assignedBIds.includes(b.id));
                    const filteredBuildingsIds = filteredBuildings.map(b => b.id);

                    const filteredUnits = assignedBIds === null ? (uRes.data || []) : (uRes.data || []).filter(u => filteredBuildingsIds.includes(u.building_id));
                    const filteredReceipts = assignedBIds === null ? (rRes.data || []) : (rRes.data || []).filter(r => filteredBuildingsIds.includes(r.building_id));
                    const filteredExpenses = assignedBIds === null ? (eRes.data || []) : (eRes.data || []).filter(e => filteredBuildingsIds.includes(e.building_id));

                    setReceipts(filteredReceipts);
                    setExpenses(filteredExpenses);
                    setBuildings(filteredBuildings);
                    setUnits(filteredUnits);
                } catch (err) {
                    message.error("خطأ في تحميل بيانات السندات: " + err.message);
                } finally {
                    setLoading(false);
                }
            }, [profile]);

            useEffect(() => {
                fetchData();
                const channel = supabase.channel('vouchers-ledger-changes')
                    .on('postgres_changes', { event: '*', schema: 'public', table: 'receipts' }, fetchData)
                    .on('postgres_changes', { event: '*', schema: 'public', table: 'vouchers_expense' }, fetchData)
                    .on('postgres_changes', { event: '*', schema: 'public', table: 'buildings' }, fetchData)
                    .on('postgres_changes', { event: '*', schema: 'public', table: 'units' }, fetchData)
                    .subscribe();
                return () => {
                    channel.unsubscribe();
                };
            }, [fetchData]);

            // Automatically print once modal is rendered
            useEffect(() => {
                if (printOnLoad && (receiptModalVisible || expensePreviewVisible)) {
                    setPrintOnLoad(false);
                    setTimeout(() => {
                        window.print();
                    }, 350);
                }
            }, [printOnLoad, receiptModalVisible, expensePreviewVisible]);

            // Reset dependent cascading filters
            const handleCityChange = (val) => {
                setSelectedCity(val);
                setSelectedBuilding(null);
                setSelectedUnit(null);
            };

            const handleBuildingChange = (val) => {
                setSelectedBuilding(val);
                setSelectedUnit(null);
            };

            // Options for cascading filters
            const filteredBuildingsOptions = useMemo(() => {
                if (!selectedCity) return buildings;
                return buildings.filter(b => b.city_id === selectedCity);
            }, [buildings, selectedCity]);

            const filteredUnitsOptions = useMemo(() => {
                if (!selectedBuilding) return [];
                return units.filter(u => u.building_id === selectedBuilding);
            }, [units, selectedBuilding]);

            // Merge receipts & expenses into a unified chronological stream
            const mergedStream = useMemo(() => {
                const stream = [];

                receipts.forEach(r => {
                    const b = buildings.find(b => b.id === r.building_id);
                    const u = units.find(u => u.id === r.unit_id);
                    stream.push({
                        id: `receipt-${r.id}`,
                        date: r.created_at,
                        type: 'receipt',
                        refNumber: r.receipt_number,
                        buildingId: r.building_id,
                        buildingName: b ? b.name : (r.building_name || '-'),
                        cityId: b ? b.city_id : null,
                        unitId: r.unit_id,
                        unitNumber: u ? u.unit_number : (r.unit_number || '-'),
                        amount: r.amount_received || 0,
                        paymentMethod: r.payment_method,
                        category: 'إيراد إيجار',
                        description: `دفعة إيجار - المستأجر: ${r.tenant_name || '-'}`,
                        approvalStatus: 'approved',
                        rawItem: r
                    });
                });

                expenses.forEach(e => {
                    const b = buildings.find(b => b.id === e.building_id);
                    const u = units.find(u => u.id === e.unit_id);
                    const catAr = e.category === 'Maintenance' ? 'صيانة' : e.category === 'Utilities' ? 'خدمات' : e.category === 'General' ? 'أخرى' : e.category;
                    stream.push({
                        id: `expense-${e.id}`,
                        date: e.created_at,
                        type: 'expense',
                        refNumber: e.voucher_number,
                        buildingId: e.building_id,
                        buildingName: b ? b.name : '-',
                        cityId: b ? b.city_id : null,
                        unitId: e.unit_id,
                        unitNumber: u ? u.unit_number : 'عام للمبنى',
                        amount: e.amount || 0,
                        paymentMethod: e.payment_method,
                        category: `مصروف (${catAr})`,
                        description: e.description || '-',
                        approvalStatus: e.approval_status || 'pending',
                        rawItem: e
                    });
                });

                return stream.sort((a, b) => new Date(b.date) - new Date(a.date));
            }, [receipts, expenses, buildings, units]);

            // Filter stream based on active selections
            const filteredStream = useMemo(() => {
                return mergedStream.filter(item => {
                    if (selectedCity && item.cityId !== selectedCity) return false;
                    if (selectedBuilding && item.buildingId !== selectedBuilding) return false;
                    if (selectedUnit && item.unitId !== selectedUnit) return false;
                    if (voucherType !== 'all' && item.type !== voucherType) return false;

                    // Date Filters
                    if (calendarMode === 'Gregorian' && gregorianRange && gregorianRange.length === 2) {
                        const start = gregorianRange[0].startOf('day');
                        const end = gregorianRange[1].endOf('day');
                        const itemDate = dayjs(item.date);
                        if (itemDate.isBefore(start) || itemDate.isAfter(end)) return false;
                    }

                    if (calendarMode === 'Hijri' && hijriYear) {
                        const { startDate, endDate } = getGregorianRangeForHijriMonth(
                            hijriYear,
                            hijriMonth === 'all' ? null : parseInt(hijriMonth, 10)
                        );
                        if (startDate && endDate) {
                            const itemDate = new Date(item.date);
                            if (itemDate                           endDate) return false;
                        }
                    }

                    // Text Search
                    if (searchText) {
                        const s = searchText.toLowerCase();
                        const refMatch = item.refNumber?.toLowerCase().includes(s);
                        const descMatch = item.description?.toLowerCase().includes(s);
                        const bMatch = item.buildingName?.toLowerCase().includes(s);
                        const uMatch = item.unitNumber?.toLowerCase().includes(s);
                        if (!refMatch && !descMatch && !bMatch && !uMatch) return false;
                    }

                    return true;
                });
            }, [mergedStream, selectedCity, selectedBuilding, selectedUnit, voucherType, calendarMode, gregorianRange, hijriYear, hijriMonth, searchText]);

            // Calculate KPI aggregates (only count approved expenses for totals)
            const kpis = useMemo(() => {
                let totalReceipts = 0;
                let totalExpenses = 0;

                filteredStream.forEach(item => {
                    if (item.type === 'receipt') {
                        totalReceipts += item.amount;
                    } else if (item.type === 'expense' && item.approvalStatus === 'approved') {
                        totalExpenses += item.amount;
                    }
                });

                return {
                    totalReceipts,
                    totalExpenses,
                    netCash: totalReceipts - totalExpenses
                };
            }, [filteredStream]);

            // Open popup detail view modal
            const handleViewRow = (item) => {
                if (item.type === 'receipt') {
                    setActiveReceipt(item.rawItem);
                    setReceiptModalVisible(true);
                } else {
                    const b = buildings.find(b => b.id === item.rawItem.building_id);
                    const u = units.find(u => u.id === item.rawItem.unit_id);
                    setActiveExpense({
                        ...item.rawItem,
                        building_name: b ? b.name : '-',
                        unit_number: u ? u.unit_number : 'عام للمبنى',
                        created_by_email: item.rawItem.created_by_email || ''
                    });
                    setExpensePreviewVisible(true);
                }
            };

            // Print voucher directly from row
            const handlePrintRow = (item, e) => {
                if (e) e.stopPropagation();
                setPrintOnLoad(true);
                handleViewRow(item);
            };

            return (
                                           
                    {/* Filter Panel Card */}
                                                                                                                                             🔍        تصفية وبحث السندات الموحدة      }>
                                                   
                            {/* Row 1: City -> Building -> Unit */}
                                                   
                                                    
                                                                                المدينة (City)      
                                                                                                                                                                                                                                                                                                                                                                                                                           ({ label: c.name_ar, value: c.id }))}
                                    />
                                      
                                                    
                                                                                العمارة (Building)      
                                                                                                                                                                                                                                                                                                                                                                                                                                                        ({ label: b.name, value: b.id }))}
                                    />
                                      
                                                    
                                                                                الوحدة (Unit)      
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               ({ label: `وحدة ${u.unit_number}`, value: u.id }))}
                                    />
                                      
                                  

                            {/* Row 2: Voucher Type, Date Calendars, Search */}
                                                   
                                                    
                                                                                نوع السند (Voucher Type)      
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       
                                      

                                                     
                                                                                نوع التقويم والنطاق الزمني      
                                                                             
                                                                                                                                                                                   setCalendarMode(e.target.value)}
                                            size="middle"
                                            className="flex-shrink-0"
                                        >
                                                                            ميلادي               
                                                                        هجري               
                                                      
                                        {calendarMode === 'Gregorian' ? (
                                                                                                                                                                                                                                                                                                                                                                                                                                  
                                        ) : (
                                                                               
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   ({ label: `${y} هـ`, value: y }))}
                                                />
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                
                                                  
                                        )}
                                          
                                      

                                                    
                                                                                بحث نصي ديناميكي (البحث)      
                                                                                                                                                                                                                                                          setSearchText(e.target.value)}
                                        prefix={                                            }
                                        allowClear
                                    />
                                      
                                  
                              
                           

                    {/* KPI metrics bar banner */}
                                                                                                 
                                               
                                                
                                                                                                                 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                  }
                                    />
                                       
                                  
                                                
                                                                                                             
                                                                                                                                                                                                                                                                                                                                                                                                                                                            }
                                    />
                                       
                                  
                                                
                                                                                                               
                                                                                                                                                                                                                                                                                                                                        = 0 ? '#b58d1b' : '#cf222e', fontWeight: 'bold' }}
                                        prefix={                                             }
                                    />
                                       
                                  
                              
                          

                    {/* Master Ledger Data Table */}
                                                                                           
                                                                                                                                                                                                                            ({
                                onClick: () => handleViewRow(record),
                                className: "cursor-pointer hover:bg-slate-50 transition-colors"
                            })}
                            columns={[
                                {
                                    title: 'التاريخ (Date)',
                                    dataIndex: 'date',
                                    key: 'date',
                                    render: (date) => (
                                             
                                                 {dayjs(date).format('YYYY-MM-DD م')}      
                                                                                                     {toHijri(date)} هـ      
                                              
                                    )
                                },
                                { title: 'رقم السند (Ref)', dataIndex: 'refNumber', key: 'refNumber', className: 'font-semibold' },
                                {
                                    title: 'النوع (Type)',
                                    dataIndex: 'type',
                                    key: 'type',
                                    render: (type) => (
                                                                                              
                                            {type === 'receipt' ? 'سند قبض' : 'سند صرف'}
                                              
                                    )
                                },
                                { title: 'العقار (Building)', dataIndex: 'buildingName', key: 'buildingName' },
                                { title: 'الوحدة (Unit)', dataIndex: 'unitNumber', key: 'unitNumber' },
                                {
                                    title: 'المبلغ (Amount)',
                                    dataIndex: 'amount',
                                    key: 'amount',
                                    render: (val, record) => (
                                                                                                                                         
                                            {record.type === 'receipt' ? '+' : '-'}{sarFormatter(val)}
                                               
                                    )
                                },
                                {
                                    title: 'طريقة الدفع (Payment)',
                                    dataIndex: 'paymentMethod',
                                    key: 'paymentMethod',
                                    render: (method) => method === 'Bank Transfer' ? 'تحويل بنكي' : 'كاش'
                                },
                                { title: 'البيان والتفاصيل (Details)', dataIndex: 'description', key: 'description', className: 'text-gray-500 max-w-[200px] truncate' },
                                {
                                    title: 'حالة الاعتماد (Status)',
                                    key: 'status',
                                    render: (_, record) => {
                                        if (record.type === 'receipt') {
                                            return                    معتمد تلقائياً      ;
                                        }
                                        const status = record.approvalStatus;
                                        let color = 'gold';
                                        let text = 'قيد المراجعة';
                                        if (status === 'approved') {
                                            color = 'green';
                                            text = 'معتمد';
                                        } else if (status === 'rejected') {
                                            color = 'red';
                                            text = 'مرفوض';
                                        }
                                        return                    {text}      ;
                                    }
                                },
                                {
                                    title: 'إجراءات (Actions)',
                                    key: 'actions',
                                    render: (_, record) => (
                                                             e.stopPropagation()}>
                                                                                            handleViewRow(record)}>تصفح         
                                                                                                                                                                                                                                                                                                                                                                                              🖨️       } 
                                                onClick={(e) => handlePrintRow(record, e)}
                                            >
                                                طباعة
                                                     
                                                
                                    )
                                }
                            ]}
                        />
                           

                    {/* Popups & Modals */}
                                                                                                                                                                               { setReceiptModalVisible(false); setActiveReceipt(null); }}
                    />

                                                                                                                                                                                        { setExpensePreviewVisible(false); setActiveExpense(null); }}
                    />
                      
            );
        };

        // --- Component: TreasuryDashboard ---
        const TreasuryDashboard = ({ cities, profile }) => {
            const [receipts, setReceipts] = useState([]);
            const [expenses, setExpenses] = useState([]);
            const [buildings, setBuildings] = useState([]);
            const [loading, setLoading] = useState(true);

            // Filter states
            const [selectedCity, setSelectedCity] = useState(null);
            const [selectedBuilding, setSelectedBuilding] = useState(null);

            // Date filtering states
            const [calendarMode, setCalendarMode] = useState('Gregorian'); // Gregorian or Hijri
            const [gregorianRange, setGregorianRange] = useState(null);
            const [hijriYear, setHijriYear] = useState(null);
            const [hijriMonth, setHijriMonth] = useState('all');

            const fetchData = useCallback(async () => {
                setLoading(true);
                try {
                    const [rRes, eRes, bRes] = await Promise.all([
                        supabase.from('receipts').select('*'),
                        supabase.from('vouchers_expense').select('*'),
                        supabase.from('buildings').select('*')
                    ]);
                    
                    if (rRes.error) throw rRes.error;
                    if (eRes.error) throw eRes.error;
                    if (bRes.error) throw bRes.error;

                    const assignedBIds = getAssignedBuildingIds(profile);

                    const filteredBuildings = assignedBIds === null ? (bRes.data || []) : (bRes.data || []).filter(b => assignedBIds.includes(b.id));
                    const filteredBuildingsIds = filteredBuildings.map(b => b.id);

                    const filteredReceipts = assignedBIds === null ? (rRes.data || []) : (rRes.data || []).filter(r => filteredBuildingsIds.includes(r.building_id));
                    const filteredExpenses = assignedBIds === null ? (eRes.data || []) : (eRes.data || []).filter(e => filteredBuildingsIds.includes(e.building_id));

                    setReceipts(filteredReceipts);
                    setExpenses(filteredExpenses);
                    setBuildings(filteredBuildings);
                } catch (err) {
                    message.error("خطأ في تحميل بيانات الخزينة: " + err.message);
                } finally {
                    setLoading(false);
                }
            }, [profile]);

            useEffect(() => {
                fetchData();
                const channel = supabase.channel('treasury-dashboard-changes')
                    .on('postgres_changes', { event: '*', schema: 'public', table: 'receipts' }, fetchData)
                    .on('postgres_changes', { event: '*', schema: 'public', table: 'vouchers_expense' }, fetchData)
                    .on('postgres_changes', { event: '*', schema: 'public', table: 'buildings' }, fetchData)
                    .subscribe();
                return () => {
                    channel.unsubscribe();
                };
            }, [fetchData]);

            const handleCityChange = (val) => {
                setSelectedCity(val);
                setSelectedBuilding(null);
            };

            const filteredBuildingsOptions = useMemo(() => {
                if (!selectedCity) return buildings;
                return buildings.filter(b => b.city_id === selectedCity);
            }, [buildings, selectedCity]);

            // Helper to check if a date is within Gregorian range
            const isWithinDateFilter = useCallback((dateStr) => {
                if (!dateStr) return false;
                
                if (calendarMode === 'Gregorian' && gregorianRange && gregorianRange.length === 2) {
                    const start = gregorianRange[0].startOf('day');
                    const end = gregorianRange[1].endOf('day');
                    const itemDate = dayjs(dateStr);
                    if (itemDate.isBefore(start) || itemDate.isAfter(end)) return false;
                }

                if (calendarMode === 'Hijri' && hijriYear) {
                    const { startDate, endDate } = getGregorianRangeForHijriMonth(
                        hijriYear,
                        hijriMonth === 'all' ? null : parseInt(hijriMonth, 10)
                    );
                    if (startDate && endDate) {
                        const itemDate = new Date(dateStr);
                        if (itemDate                           endDate) return false;
                    }
                }
                return true;
            }, [calendarMode, gregorianRange, hijriYear, hijriMonth]);

            // Financial Calculations
            const financialData = useMemo(() => {
                // Filter receipts first
                const filteredReceipts = receipts.filter(r => {
                    if (!isWithinDateFilter(r.created_at)) return false;
                    const b = buildings.find(building => building.id === r.building_id);
                    if (selectedCity && (!b || b.city_id !== selectedCity)) return false;
                    if (selectedBuilding && r.building_id !== selectedBuilding) return false;
                    return true;
                });

                // Filter expenses (approved only)
                const filteredExpenses = expenses.filter(e => {
                    if (e.approval_status !== 'approved') return false;
                    if (!isWithinDateFilter(e.created_at)) return false;
                    const b = buildings.find(building => building.id === e.building_id);
                    if (selectedCity && (!b || b.city_id !== selectedCity)) return false;
                    if (selectedBuilding && e.building_id !== selectedBuilding) return false;
                    return true;
                });

                // Sum global
                let globalReceiptsCash = 0;
                let globalReceiptsBank = 0;
                let globalExpensesCash = 0;
                let globalExpensesBank = 0;

                filteredReceipts.forEach(r => {
                    if (r.payment_method === 'Cash') {
                        globalReceiptsCash += r.amount_received || 0;
                    } else if (r.payment_method === 'Bank Transfer') {
                        globalReceiptsBank += r.amount_received || 0;
                    }
                });

                filteredExpenses.forEach(e => {
                    if (e.payment_method === 'Cash') {
                        globalExpensesCash += e.amount || 0;
                    } else if (e.payment_method === 'Bank Transfer') {
                        globalExpensesBank += e.amount || 0;
                    }
                });

                const globalCash = globalReceiptsCash - globalExpensesCash;
                const globalBank = globalReceiptsBank - globalExpensesBank;
                const globalTotal = globalCash + globalBank;

                // Building level boxes
                const visibleBuildings = buildings.filter(b => {
                    if (selectedCity && b.city_id !== selectedCity) return false;
                    if (selectedBuilding && b.id !== selectedBuilding) return false;
                    return true;
                });

                const buildingBoxes = visibleBuildings.map(b => {
                    const bReceipts = receipts.filter(r => r.building_id === b.id && isWithinDateFilter(r.created_at));
                    const bExpenses = expenses.filter(e => e.building_id === b.id && e.approval_status === 'approved' && isWithinDateFilter(e.created_at));

                    let bCashIn = 0;
                    let bBankIn = 0;
                    let bCashOut = 0;
                    let bBankOut = 0;

                    bReceipts.forEach(r => {
                        if (r.payment_method === 'Cash') bCashIn += r.amount_received || 0;
                        else if (r.payment_method === 'Bank Transfer') bBankIn += r.amount_received || 0;
                    });

                    bExpenses.forEach(e => {
                        if (e.payment_method === 'Cash') bCashOut += e.amount || 0;
                        else if (e.payment_method === 'Bank Transfer') bBankOut += e.amount || 0;
                    });

                    const cashBox = bCashIn - bCashOut;
                    const bankBox = bBankIn - bBankOut;
                    const totalBox = cashBox + bankBox;

                    // Overdraft status
                    let status = 'success';
                    if (cashBox                                                                                                                                                                                                                                                                                                                                                  c.id === b.city_id)?.name_ar || '-',
                        cashBox,
                        bankBox,
                        totalBox,
                        status
                    };
                });

                return {
                    globalCash,
                    globalBank,
                    globalTotal,
                    buildingBoxes
                };
            }, [receipts, expenses, buildings, selectedCity, selectedBuilding, calendarMode, gregorianRange, hijriYear, hijriMonth, isWithinDateFilter, cities]);

            if (loading) {
                return (
                                                                           
                                                                                
                          
                );
            }

            return (
                                           
                    {/* Header */}
                                                                                                                                  
                             
                                                                                                   
                                                   شاشة الخزينة والصندوق (Treasury & Cash Dashboard)
                                    
                                                   
                                تحليلات الخزينة العامة، الأرصدة البنكية، والصناديق النقدية للعقارات في بث حي ومباشر
                                   
                              
                          

                    {/* Filter Panel */}
                                                                                                                                             🔍        تصفية وبحث حسابات الخزينة      }>
                                                   
                                                   
                                                    
                                                                                المدينة (City)      
                                                                                                                                                                                                                                                                                                                                                                                                                              !profile || profile.role === 'admin' || buildings.some(b => b.city_id === c.id)).map(c => ({ label: c.name_ar, value: c.id }))}
                                    />
                                      
                                                    
                                                                                العمارة (Building)      
                                                                                                                                                                                                                                                                                                                                                                                                                                                       ({ label: b.name, value: b.id }))}
                                    />
                                      
                                                    
                                                                                نوع التقويم والنطاق الزمني      
                                                                             
                                                                                                                                                                                   setCalendarMode(e.target.value)}
                                            size="middle"
                                            className="flex-shrink-0"
                                        >
                                                                            ميلادي               
                                                                        هجري               
                                                      
                                        {calendarMode === 'Gregorian' ? (
                                                                                                                                                                                                                                                                                                                                                                                                                                  
                                        ) : (
                                                                               
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   ({ label: `${y} هـ`, value: y }))}
                                                />
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                
                                                  
                                        )}
                                          
                                      
                                  
                              
                           

                    {/* Section 2: Global Treasury Summary */}
                                                                           
                        {/* Total Liquid Assets */}
                                                                                                                                                   = 0 ? 'border-t-emerald-600' : 'border-t-red-600'}`}>
                                                                              
                                     
                                                                                               إجمالي الأموال السائلة (Total Liquid Assets)      
                                                                                                     = 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                        {sarFormatter(financialData.globalTotal)}
                                         
                                      
                                                                                             = 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                                                                                   
                                      
                                  
                              

                        {/* Global Bank Balance */}
                                                                                                                                                  = 0 ? 'border-t-indigo-600' : 'border-t-red-600'}`}>
                                                                              
                                     
                                                                                               رصيد حسابات البنوك (Global Bank Balance)      
                                                                                                    = 0 ? 'text-indigo-600' : 'text-red-600'}`}>
                                        {sarFormatter(financialData.globalBank)}
                                         
                                      
                                                                                            = 0 ? 'bg-indigo-50 text-indigo-600' : 'bg-red-50 text-red-600'}`}>
                                                                                 
                                      
                                  
                              

                        {/* Global Cash Box */}
                                                                                                                                                  = 0 ? 'border-t-amber-600' : 'border-t-red-600'}`}>
                                                                              
                                     
                                                                                               إجمالي رصيد الصندوق (Global Cash Box)      
                                                                                                    = 0 ? 'text-amber-600' : 'text-red-600'}`}>
                                        {sarFormatter(financialData.globalCash)}
                                         
                                      
                                                                                            = 0 ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'}`}>
                                                                                   
                                      
                                  
                              
                          

                    {/* Section 3: Building Cash Boxes Grid */}
                                                                                                       🏢        صناديق وأرصدة العمارات (Building Cash Boxes)      } className="shadow-sm">
                        {financialData.buildingBoxes.length === 0 ? (
                                                                               
                        ) : (
                                                   
                                {financialData.buildingBoxes.map(box => {
                                    // Calculate cash vs bank ratio
                                    const absCash = Math.abs(box.cashBox);
                                    const absBank = Math.abs(box.bankBox);
                                    const totalAbs = absCash + absBank;
                                    const cashPercent = totalAbs > 0 ? Math.round((absCash / totalAbs) * 100) : 50;
                                    const bankPercent = totalAbs > 0 ? Math.round((absBank / totalAbs) * 100) : 50;

                                    // Overdraft visual indicators
                                    let cardStyle = "border border-slate-200 bg-white hover:border-slate-300";
                                    let badgeColor = "default";
                                    let badgeText = "مستقر";
                                    
                                    if (box.status === 'error') {
                                        cardStyle = "border-2 border-red-500 bg-red-50/10 shadow-sm relative animate-overdraft-pulse";
                                        badgeColor = "red";
                                        badgeText = "عجز / مكشوف";
                                    } else if (box.status === 'warning') {
                                        cardStyle = "border border-amber-300 bg-amber-50/10 shadow-sm";
                                        badgeColor = "warning";
                                        badgeText = "رصيد منخفض";
                                    } else {
                                        cardStyle = "border border-emerald-200 bg-emerald-50/5 hover:border-emerald-300";
                                        badgeColor = "success";
                                        badgeText = "كافٍ ومستقر";
                                    }

                                    return (
                                                                                 
                                                                                                                        
                                                                                                       
                                                         
                                                                                                               {box.name}     
                                                                                                 {box.city}       
                                                          
                                                                                                          {badgeText}      
                                                      

                                                                                
                                                                                                               
                                                                                         المحصل بنكياً:       
                                                                                                   = 0 ? 'text-indigo-600' : 'text-red-600'}`}>
                                                            {sarFormatter(box.bankBox)}
                                                               
                                                          
                                                                                                               
                                                                                         الصندوق (كاش):       
                                                                                                   = 0 ? 'text-amber-600' : 'text-red-600'}`}>
                                                            {sarFormatter(box.cashBox)}
                                                               
                                                          
                                                                                
                                                                                                                         
                                                                                         صافي رصيد العقار:       
                                                                                       = 0 ? 'text-emerald-600' : 'text-red-600'}>
                                                            {sarFormatter(box.totalBox)}
                                                               
                                                          

                                                    {/* Ratio visual indicator */}
                                                                                    
                                                                                                                                      
                                                                  كاش ({cashPercent}%)       
                                                                  بنك ({bankPercent}%)       
                                                              
                                                                                                                                     
                                                                                                                                            
                                                                                                                                             
                                                              
                                                          
                                                      
                                                  
                                              
                                    );
                                })}
                                  
                        )}
                           
                      
            );
        };

        // --- Main App ---

        const App = () => {
            const [user, setUser] = useState(null);
            const [profile, setProfile] = useState(null);
            const [loading, setLoading] = useState(true);
            const [activeTab, setActiveTab] = useState('dashboard');
            const [cities, setCities] = useState([]);
            const [selectedCity, setSelectedCity] = useState(null);
            const [stats, setStats] = useState({ totalBuildings: 0, totalUnits: 0, totalPaid: 0, collectionRate: 0, cityStats: [] });
            const [allUsers, setAllUsers] = useState([]);
            const [allBuildings, setAllBuildings] = useState([]);

            const fetchProfile = async (u) => {
                const { data } = await supabase.from('profiles').select('*').eq('id', u.id).single();
                setProfile(data);
                return data;
            };

            const fetchInitialData = async (prof) => {
                const { data: cityData } = await supabase.from('cities').select('*').order('created_at', { ascending: true });
                // Deduplicate by name_ar — keep the first (oldest) occurrence of each city name
                const seenNames = new Set();
                const uniqueCities = (cityData || []).filter(c => {
                    if (seenNames.has(c.name_ar)) return false;
                    seenNames.add(c.name_ar);
                    return true;
                });
                setCities(uniqueCities);

                // Set Riyadh as default if available
                // Stats calculation
                const { data: bDataRaw } = await supabase.from('buildings').select('*');
                setAllBuildings(bDataRaw || []); // Store unfiltered for AdminPanel
                const { data: uDataRaw } = await supabase.from('units').select('*');

                // RBAC: Filter buildings and units by assigned_buildings
                const assignedIds = getAssignedBuildingIds(prof);
                const bData = assignedIds === null ? (bDataRaw || []) : (bDataRaw || []).filter(b => assignedIds.includes(b.id));
                const bIds = bData.map(b => b.id);
                const uData = (uDataRaw || []).filter(u => bIds.includes(u.building_id));

                const totalBuildings = bData.length;
                const totalUnits = uData.length;
                const rentedUnitsData = uData.filter(u => u.is_rented);
                const totalPaid = rentedUnitsData.reduce((acc, u) => acc + (u.amount_paid || 0), 0) || 0;
                const totalExpected = rentedUnitsData.reduce((acc, u) => acc + (u.monthly_rent || 0), 0) || 1;

                const cityStats = uniqueCities?.map(c => {
                    const cBuildings = bData.filter(b => b.city_id === c.id);
                    const cUnits = uData.filter(u => cBuildings.some(b => b.id === u.building_id));
                    const cRentedUnits = cUnits.filter(u => u.is_rented);
                    return {
                        id: c.id,
                        name: c.name_ar,
                        buildings: cBuildings.length,
                        paid: cRentedUnits.reduce((acc, u) => acc + (u.amount_paid || 0), 0),
                        expected: cRentedUnits.reduce((acc, u) => acc + (u.monthly_rent || 0), 0) || 1
                    };
                }).filter(cs => cs.buildings > 0) || [];

                const rentedUnits = rentedUnitsData.length;
                const vacantUnits = uData.filter(u => !u.is_rented).length;
                const { data: rDataRaw } = await supabase.from('receipts').select('amount_received, payment_method, building_id');
                // RBAC: Filter receipts by assigned buildings
                const rData = (rDataRaw || []).filter(r => bIds.includes(r.building_id));
                const collectedCash = rData.filter(r => r.payment_method === 'Cash').reduce((acc, r) => acc + (r.amount_received || 0), 0);
                const collectedBank = rData.filter(r => r.payment_method === 'Bank Transfer').reduce((acc, r) => acc + (r.amount_received || 0), 0);

                const buildingSummaries = bData.map(b => {
                    const bUnits = uData.filter(u => u.building_id === b.id);
                    const rentedUnits = bUnits.filter(u => u.is_rented);
                    const expected = rentedUnits.reduce((acc, u) => acc + (u.monthly_rent || 0), 0);
                    const paid = rentedUnits.reduce((acc, u) => acc + (u.amount_paid || 0), 0);
                    return {
                        id: b.id,
                        key: b.id,
                        name: b.name,
                        city: uniqueCities?.find(c => c.id === b.city_id)?.name_ar || '-',
                        unitCount: bUnits.length || b.unit_count || 0,
                        rentedCount: rentedUnits.length,
                        vacantCount: bUnits.filter(u => !u.is_rented).length,
                        expected: expected,
                        paid: paid,
                        remaining: expected - paid
                    };
                });

                setStats({
                    totalBuildings,
                    rentedUnits,
                    vacantUnits,
                    totalPaid,
                    collectedCash,
                    collectedBank,
                    collectionRate: Math.round((totalPaid / totalExpected) * 100),
                    cityStats,
                    buildingSummaries
                });

                if (prof && prof.role === 'admin') {
                    const { data: userData } = await supabase.from('profiles').select('*');
                    setAllUsers(userData || []);
                }
            };

            useEffect(() => {
                const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
                    if (session) {
                        setUser(session.user);
                        const prof = await fetchProfile(session.user);
                        if (prof) {
                            await fetchInitialData(prof);
                            // Realtime Subscriptions
                            const channel = supabase.channel('schema-db-changes')
                                .on('postgres_changes', { event: '*', schema: 'public', table: 'buildings' }, () => fetchProfile(session.user).then(p => p && fetchInitialData(p)))
                                .on('postgres_changes', { event: '*', schema: 'public', table: 'units' }, () => fetchProfile(session.user).then(p => p && fetchInitialData(p)))
                                .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchProfile(session.user).then(p => p && fetchInitialData(p)))
                                .on('postgres_changes', { event: '*', schema: 'public', table: 'receipts' }, () => fetchProfile(session.user).then(p => p && fetchInitialData(p)))
                                .on('postgres_changes', { event: '*', schema: 'public', table: 'vouchers_expense' }, () => fetchProfile(session.user).then(p => p && fetchInitialData(p)))
                                .on('postgres_changes', { event: '*', schema: 'public', table: 'cities' }, () => fetchProfile(session.user).then(p => p && fetchInitialData(p)))
                                .subscribe();
                        }
                    } else {
                        setUser(null);
                        setProfile(null);
                        setLoading(false);
                    }
                });

                supabase.auth.getSession().then(async ({ data: { session } }) => {
                    if (session) {
                        setUser(session.user);
                        const prof = await fetchProfile(session.user);
                        if (prof) await fetchInitialData(prof);
                    }
                }).catch(err => {
                    console.error("Auth session error:", err);
                    message.error("خطأ في الاتصال بقاعدة البيانات: " + err.message);
                }).finally(() => {
                    setLoading(false);
                });

                return () => subscription.unsubscribe();
            }, []);

            const handleLogout = async () => {
                await supabase.auth.signOut();
                window.location.href = window.location.origin + window.location.pathname;
            };

            const handleUpdateUser = async (userId, updates) => {
                const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
                if (error) message.error(error.message);
                else {
                    message.success("تم تحديث بيانات المستخدم");
                    const { data: userData } = await supabase.from('profiles').select('*');
                    setAllUsers(userData || []);
                }
            };

            if (loading) return                                                                                                                            ;
            if (!user) return                        { setUser(u); fetchProfile(u).then(prof => fetchInitialData(prof)); }} />;

            return (
                                                                                                                                                 
                                                     
                                                                                                                                                                                                                    
                                                                                      
                                                                        } className="bg-primary mb-2" />
                                                                                 {displayUsername(profile?.email)}      
                                                                   {profile?.role === 'admin' ? 'مدير نظام' : 'مدير عقارات'}      
                                  
                                                                                                                                                                                                 {
                                    if (key === 'logout') {
                                        handleLogout();
                                    } else {
                                        setActiveTab(key);
                                    }
                                }}
                                className="border-none mt-4"
                                items={[
                                    { key: 'dashboard', icon:                      , label: 'لوحة المعلومات' },
                                    { key: 'properties', icon:                 , label: 'إدارة العقارات' },
                                    { key: 'vouchers', icon:                   , label: 'السندات' },
                                    { key: 'treasury', icon:                   , label: 'الخزينة والصناديق' },
                                    (profile?.can_report || profile?.role === 'admin') ? { key: 'reports', icon:                     , label: 'التقارير' } : null,
                                    (profile?.role === 'admin' || profile?.email === SUPER_ADMIN_EMAIL) ? { key: 'admin', icon:                 , label: 'إدارة النظام' } : null,
                                    { key: 'logout', icon:                   , label: 'تسجيل الخروج', danger: true }
                                ].filter(Boolean)}
                            />
                                
                                
                                                                                                                                   
                                                                               بوابة تحصيل الإيجارات        
                                       
                                                           {dayjs().format('DD MMMM YYYY')}       
                                        
                                     
                                                                   
                                {activeTab === 'dashboard' &&                            }
                                {activeTab === 'properties' && (
                                                                                                                                                                                                             
                                )}
                                {activeTab === 'vouchers' && (
                                                                                                                                                                                                            
                                )}
                                {activeTab === 'treasury' && (
                                                                                                                                                                                                               
                                )}
                                {activeTab === 'reports' &&                                                }
                                {activeTab === 'admin' && profile?.role === 'admin' && (
                                                                                                                                                                                                                                                                                                                                                   
                                )}
                                      
                                                                                  
                                جميع الحقوق محفوظة © {new Date().getFullYear()} بوابة تحصيل الإيجارات - المملكة العربية السعودية
                                     
                                 
                             
                                 
            );
        };

        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(       );
    