import { createContext,useEffect,useState } from "react";
import axios from "axios"
import config from "../config/config"


export const StoreContext= createContext(null)

const StoreContextProvider =(props)=>{

    
    const [cartItems,setCartItems] = useState({});  
    const [cartItemsData, setCartItemsData] = useState({}); // Store full item data including options
    const url = config.BACKEND_URL
    const [token,setToken]=useState("")
    const [food_list,setFoodList]=useState([]);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isLoadingFood, setIsLoadingFood] = useState(false);
    const [foodPagination, setFoodPagination] = useState(null);
    const [boxFee, setBoxFee] = useState(160); // Default box fee in HUF, fetched from backend
    const [restaurantInfo, setRestaurantInfo] = useState(null);
    const [restaurantInfoLoading, setRestaurantInfoLoading] = useState(true);

    const addToCart =async (itemId, itemData = null) =>{  
        if (!cartItems[itemId]) {  
            setCartItems((prev)=>({...prev,[itemId]:1}))  
        }  
        else {  
            setCartItems((prev)=>({...prev,[itemId]:prev[itemId]+1}))  
        } 
        
        // Store full item data if provided
        if (itemData) {
            setCartItemsData((prev) => ({
                ...prev,
                [itemId]: itemData
            }))
        }
        
        if (token){
            // For now, just send itemId. In the future, you might want to send options data
            await axios.post(url+"/api/cart/add",{itemId},{headers:{token}})
        }
    }  
  
    const removeFromCart = async(itemId) => {
        setCartItems((prev)=>({...prev,[itemId]:prev[itemId]-1}))  
        
        // Remove item data if quantity becomes 0
        if (cartItems[itemId] <= 1) {
            setCartItemsData((prev) => {
                const newData = { ...prev }
                delete newData[itemId]
                return newData
            })
        }
        
        if (token) {
            await axios.post(url+"/api/cart/remove",{itemId},{headers:{token}})
        }
    }  

    const getTotalCartAmount=()=>{
        let totalAmount =0;
        for(const itemId in cartItems)
            {
                if(cartItems[itemId]>0){
                // Try to get item info from cartItemsData first (for items with options)
                let itemInfo = cartItemsData[itemId];
                
                // If not in cartItemsData, fall back to food_list
                if (!itemInfo) {
                    // Extract actual product ID (before the underscore for items with options)
                    const actualProductId = itemId.split('_')[0];
                    itemInfo = food_list.find((product)=>product._id===actualProductId)
                }
                
                if (itemInfo) {
                    // Tính giá gốc (chưa bao gồm box fee)
                    let basePrice = 0;
                    
                    // Nếu có currentPrice, kiểm tra xem đã bao gồm box fee chưa
                    // currentPrice từ ProductDetail đã bao gồm box fee, nên ta cần tính lại từ giá gốc
                    if (itemInfo.options && itemInfo.options.length > 0 && itemInfo.selectedOptions) {
                        basePrice = itemInfo.price || 0;
                        
                        Object.entries(itemInfo.selectedOptions).forEach(([optionName, choiceCode]) => {
                            const option = itemInfo.options.find(opt => opt.name === optionName);
                            if (option) {
                                const choice = option.choices.find(c => c.code === choiceCode);
                                if (choice) {
                                    if (option.pricingMode === 'override') {
                                        basePrice = choice.price;
                                    } else if (option.pricingMode === 'add') {
                                        basePrice += choice.price;
                                    }
                                }
                            }
                        });
                    } else {
                        // Nếu không có options, dùng promotion price hoặc regular price
                        basePrice = itemInfo.isPromotion && itemInfo.promotionPrice ? itemInfo.promotionPrice : (itemInfo.price || 0);
                    }
                    
                    // Kiểm tra giá có hợp lệ không
                    if (isNaN(Number(basePrice)) || Number(basePrice) < 0) {
                        basePrice = 0;
                    }
                    
                    // Thêm tiền hộp nếu không tắt
                    // Check rõ ràng: chỉ tắt khi disableBoxFee === true (explicitly true)
                    // Xử lý nhiều trường hợp: boolean true, string "true", number 1, hoặc bất kỳ truthy value nào
                    const isBoxFeeDisabled = itemInfo.disableBoxFee === true || 
                                           itemInfo.disableBoxFee === "true" || 
                                           itemInfo.disableBoxFee === 1 || 
                                           itemInfo.disableBoxFee === "1" ||
                                           (typeof itemInfo.disableBoxFee === 'string' && itemInfo.disableBoxFee.toLowerCase() === 'true');
                    const itemBoxFee = isBoxFeeDisabled ? 0 : boxFee;
                    const finalPrice = Number(basePrice) + itemBoxFee;
                    
                    // Debug log
                    if (isBoxFeeDisabled) {
                        console.log('🔍 Box fee disabled for item:', itemId, itemInfo.name, 'disableBoxFee:', itemInfo.disableBoxFee);
                    }
                    
                    totalAmount += finalPrice * cartItems[itemId];
                }
                }
            }
            return totalAmount;
    }

    const fetchFoodList = async (page = 1, append = false) => {
        setIsLoadingFood(true);
        try {
            // Load all products for user (better UX, faster filtering)
            // If you have many products and want pagination, change noPagination to false and add &page=${page}&limit=20
            const response = await axios.get(url + "/api/food/list?forUser=true&noPagination=true");
            
            if (append) {
                // Append for infinite scroll (if pagination enabled)
                setFoodList(prev => [...prev, ...(response.data.data || [])]);
            } else {
                // Replace for initial load or refresh
                setFoodList(response.data.data || []);
            }
            
            setFoodPagination(response.data.pagination || null);
        } catch (error) {
            console.error('Error fetching food list:', error);
            setFoodList([]);
        } finally {
            setIsLoadingFood(false);
        }
    }
    
    const loadMoreFood = async () => {
        if (!foodPagination || !foodPagination.hasMore || isLoadingFood) return;
        await fetchFoodList(foodPagination.page + 1, true);
    }
    
    const fetchRestaurantInfo = async () => {
        try {
            setRestaurantInfoLoading(true);
            const response = await axios.get(url + "/api/restaurant-info");
            if (response.data.success) {
                setRestaurantInfo(response.data.data);
            }
        } catch (error) {
            console.error('Error fetching restaurant info:', error);
        } finally {
            setRestaurantInfoLoading(false);
        }
    }

    const fetchBoxFee = async () => {
        try {
            const response = await axios.get(url + "/api/delivery/restaurant-location");
            if (response.data.success && response.data.data) {
                const fee = response.data.data.boxFee;
                if (fee !== undefined && fee !== null) {
                    setBoxFee(Number(fee));
                }
            }
        } catch (error) {
            console.error('Error fetching box fee:', error);
            // Keep default 160 HUF if fetch fails
        }
    }
    
    const loadCartData = async (token) => {
        try {
            const response = await axios.post(url+"/api/cart/get",{},{headers:{token}});
            setCartItems(response.data.cartData);
        } catch (error) {
            console.error('Error loading cart data:', error);
            // If cart load fails, clear cart items
            setCartItems({});
        }
    }

    // Verify token with backend
    const verifyToken = async (token) => {
        try {
            const response = await axios.get(url + "/api/user/verify", {
                headers: { token }
            });
            return response.data.success === true;
        } catch (error) {
            console.error('Token verification failed:', error);
            return false;
        }
    }

    // Debug function to check token status
    const debugToken = () => {
        console.log('🔍 Current token in context:', token);
        console.log('🔍 Token in localStorage:', localStorage.getItem("token"));
        console.log('🔍 Token exists in context:', !!token);
        console.log('🔍 Token exists in localStorage:', !!localStorage.getItem("token"));
    }

    useEffect(()=>{
        async function loadData(){
            await fetchRestaurantInfo();
            await fetchFoodList();
            await fetchBoxFee(); // Fetch box fee from restaurant settings
            
            // Check for token in localStorage
            const localToken = localStorage.getItem("token");
            if (localToken) {
                console.log('🔄 Found token in localStorage, verifying...');
                
                // Verify token with backend before using it
                const isValid = await verifyToken(localToken);
                
                if (isValid) {
                    console.log('✅ Token is valid, loading user data...');
                    setToken(localToken);
                    await loadCartData(localToken);
                } else {
                    console.log('❌ Token is invalid or expired, clearing...');
                    // Token is invalid or expired, clear it
                    localStorage.removeItem("token");
                    setToken("");
                    setCartItems({});
                }
            } else {
                console.log('ℹ️ No token found in localStorage');
            }
        }
        loadData();
    },[])

    const contextValue = {  
        food_list,  
        cartItems,  
        cartItemsData,
        setCartItems,  
        addToCart,  
        removeFromCart,
        getTotalCartAmount,
        url,
        token,
        setToken,
        isMobileMenuOpen,
        setIsMobileMenuOpen,
        isLoadingFood,
        foodPagination,
        loadMoreFood,
        fetchFoodList,
        boxFee,  // Dynamic box fee from restaurant settings
        restaurantInfo,
        restaurantInfoLoading
    }

    return (
        <StoreContext.Provider value={contextValue}>
            {props.children}
        </StoreContext.Provider>
    )
}

export default StoreContextProvider