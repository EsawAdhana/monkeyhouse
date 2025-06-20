import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { HOUSING_REGIONS, NON_NEGOTIABLES, Preference, PreferenceStrength } from '@/constants/survey-constants';
import { adminDb } from '@/lib/firebase-admin';

// This endpoint is for testing purposes only
// Should be disabled in production
const ENABLE_TEST_ENDPOINT = process.env.NODE_ENV !== 'production';

// Allowed admin emails for testing access
const ALLOWED_TESTING_EMAILS = ['adhanaesaw@gmail.com'];

// Names for generating test users
const FIRST_NAMES = [
  "James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Linda", 
  "William", "Elizabeth", "David", "Barbara", "Richard", "Susan", "Joseph", "Jessica", 
  "Thomas", "Sarah", "Charles", "Karen", "Christopher", "Nancy", "Daniel", "Lisa", 
  "Matthew", "Betty", "Anthony", "Margaret", "Mark", "Sandra", "Donald", "Ashley", 
  "Steven", "Kimberly", "Paul", "Emily", "Andrew", "Donna", "Joshua", "Michelle", 
  "Kenneth", "Dorothy", "Kevin", "Carol", "Brian", "Amanda", "George", "Melissa", 
  "Edward", "Deborah", "Ronald", "Stephanie", "Timothy", "Rebecca", "Jason", "Sharon"
];

const LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Jones", "Brown", "Davis", "Miller", "Wilson", 
  "Moore", "Taylor", "Anderson", "Thomas", "Jackson", "White", "Harris", "Martin", 
  "Thompson", "Garcia", "Martinez", "Robinson", "Clark", "Rodriguez", "Lewis", "Lee", 
  "Walker", "Hall", "Allen", "Young", "Hernandez", "King", "Wright", "Lopez", 
  "Hill", "Scott", "Green", "Adams", "Baker", "Gonzalez", "Nelson", "Carter", 
  "Mitchell", "Perez", "Roberts", "Turner", "Phillips", "Campbell", "Parker", "Evans", 
  "Edwards", "Collins", "Stewart", "Sanchez", "Morris", "Rogers", "Reed", "Cook"
];

// Array of detailed additional information examples for testing LLM compatibility
const ADDITIONAL_NOTES = [
  // Morning person & night owl contrast
  "I'm an early riser who loves to go for morning runs before starting my day. I usually go to bed by 10PM and prefer a quiet living space. I enjoy cooking vegetarian meals.",
  "Night owl who codes until 2AM most nights. I prefer to sleep in when possible. Not much of a cook, but I'll gladly order takeout for everyone. I play guitar occasionally.",
  
  // Social attitudes
  "I'm very social and love having friends over on weekends. I enjoy watching movies and gaming with roommates. I'm pretty relaxed about keeping common spaces tidy.",
  "I'm a neat freak who likes everything organized. I clean regularly and expect roommates to do the same. I prefer a quiet environment for studying and working from home.",
  
  // Incompatible noise preferences
  "I need absolute silence when I sleep and work from home full-time. I can't tolerate any noise after 9PM and wake up at 6AM sharp every day. I'm extremely sensitive to sounds and smells.",
  "I'm a DJ who practices mixing music at home regularly. I need to test my mixes at moderate volume to ensure quality. I work late nights at clubs and usually sleep from 4AM until noon.",
  
  // Dietary conflicts
  "I'm strictly vegan and prefer not to have animal products in our shared fridge or cooking spaces. I'm uncomfortable with the smell of cooking meat. Sustainability is my top priority.",
  "I'm a carnivore diet enthusiast who meal preps large amounts of meat weekly. I need significant fridge space for my proteins and cook bacon most mornings. I hunt occasionally.",
  
  // Scent sensitivities
  "I'm extremely allergic to all fragrances, scented products, and chemicals. I need a fragrance-free home environment with natural cleaning products only. My allergies can trigger severe migraines.",
  "I'm a perfume collector and enjoy using different scents daily. I also make homemade candles and essential oil diffusers as a hobby and sell them online. Strong scents help me relax.",
  
  // Conflict resolution styles
  "I practice mindfulness and meditation daily and need a peaceful, harmonious living environment. I'm sensitive to negative energy and conflict. I observe silent hours every morning.",
  "I'm passionate about political activism and often host planning meetings at my apartment. I engage in heated debates regularly and believe in confronting issues directly. I'm very opinionated.",
  
  // Similar studious preferences
  "I'm a dedicated student who needs focused study time. I'm organized, quiet, and respect shared spaces. I prefer minimal drama and distractions in my living environment.",
  "I'm also studying for professional exams and need a studious environment. I keep regular hours, maintain a clean space, and prefer quiet roommates who understand academic demands.",
  
  // Complementary cooking habits
  "I love to cook elaborate meals and bake. I'm happy to share what I make and enjoy feeding others. I keep the kitchen spotless and organize meal prep efficiently.",
  "I'm a foodie who appreciates home cooking but rarely cooks myself. I'm happy to handle cleaning and dishes in exchange for shared meals. I have a sophisticated palate and give great feedback.",
  
  // Similar remote work styles
  "I work remotely in tech and have flexible hours. I'm introverted but friendly, and prefer text communication for household matters. I value privacy but enjoy occasional shared meals.",
  "I also work in tech with a remote position. I respect personal space and prefer clear digital communication about household issues. I'm quiet but enjoy connecting over shared interests.",
  
  // Contrasting decor preferences
  "I'm a minimalist who owns very few possessions. I believe in clean, empty spaces and don't like clutter or excessive decoration. I spend most evenings reading quietly.",
  "I collect vintage items and display them throughout my living space. I'm clean but my aesthetic involves lots of interesting objects and art. I'm quiet but have an eclectic style.",
  
  // Schedule differences
  "I follow a strict routine: early bed, early rise, regular exercise and meals. I prefer roommates with similar structured lifestyles and value predictability and consistency.",
  "I'm a creative type with fluctuating inspiration. Sometimes I work through the night when inspired, other times I rise early. I'm adaptable but not particularly routine-oriented.",
  
  // Social expectations
  "I'm a social butterfly who sees home as primarily a place to entertain friends. I love hosting dinner parties weekly and believe in creating a welcoming space for guests.",
  "I enjoy occasional social gatherings but need advance notice. I'm friendly but require substantial alone time to recharge. I participate in social events but also value quiet evenings.",
  
  // Additional diverse profiles
  "I have a dog named Max who is very friendly and well-trained. I enjoy outdoor activities and hiking on weekends. I'm allergic to cats, so that would be a dealbreaker.",
  "I'm a professional chef and love to cook for others. I do meal prep on Sundays and am happy to share food. I'm usually out late due to restaurant hours.",
  "I'm a medical student with an irregular schedule. I need quiet time for studying but am social when free. I'm very clean in shared spaces but my room can get messy.",
  "I practice yoga daily and meditate in the mornings. I'm vegetarian and prefer roommates who don't cook meat in shared spaces. I enjoy a calm, peaceful home environment.",
  "Musician who practices drums and guitar regularly. I'm considerate about noise levels but do need to practice at home sometimes. I'm easygoing about household chores.",
  "I work remotely and take a lot of video calls during business hours. I need reliable internet and a relatively quiet space during the day. I'm sociable in the evenings.",
  "I love hosting dinner parties and cooking for friends. I'm a social butterfly who enjoys bringing people together. I keep a clean house but I'm not obsessive about it.",
  "I'm introverted and value my personal space. I prefer minimal interaction with roommates, though I'm friendly. I keep to myself and expect others to respect my privacy.",
  "Fitness enthusiast who goes to the gym daily. I meal prep and use protein shakes regularly. I'm up early for workouts and prefer roommates with similar healthy lifestyles.",
  "I stream on Twitch and create content from home. My setup includes gaming equipment and I'm often talking while recording. I need good internet and understanding roommates.",
  "I'm a grad student who studies late into the night. I drink a lot of coffee and tend to have an irregular sleep schedule during busy periods. I'm quiet and considerate.",
  "I'm a plant parent with over 30 houseplants. I need good natural light in our living space and care about sustainability. I use eco-friendly products and recycle religiously.",
  "I have a cat named Whiskers who is very independent. I work long hours as a nurse with some overnight shifts. I'm clean and organized but not home very often.",
  "I love to bake and will fill the house with cookies and bread regularly. I'm cheerful and talkative, and enjoy having a close relationship with my roommates.",
  "I'm a minimalist who doesn't own much. I value cleanliness and organization, and prefer living with like-minded individuals. I meditate daily and practice mindfulness.",
  "I travel frequently for work, gone 1-2 weeks each month. I'm looking for roommates who are responsible and can keep an eye on things while I'm away. I'm very neat.",
  "I'm learning to play the violin and need to practice daily. I can use mutes or practice during agreed hours. Otherwise I'm quiet and spend most time reading or studying.",
  "I have weekly game nights with friends that can get a bit noisy. I'm social and love sharing meals with roommates. I do my fair share of chores but I'm not the neatest person.",
  "I follow a strict keto diet and meal prep extensively. I'm organized in the kitchen and clean up promptly. I prefer roommates who respect food boundaries.",
  "I'm a night shift worker who sleeps during the day. I need roommates who can be quiet during daytime hours. I'm otherwise flexible and easy to get along with.",
  "I'm passionate about sustainability and zero-waste living. I compost, recycle, and avoid single-use plastics. Looking for environmentally conscious roommates.",
  "I have frequent video calls with family overseas at odd hours due to time differences. I need roommates who are understanding about occasional late night conversations.",
  "I'm a film student who sometimes needs to use the living room for shooting projects. I always give advance notice and clean up thoroughly afterward.",
  "I collect vintage vinyl records and enjoy listening to music on my turntable. I respect quiet hours but music is a big part of my life.",
  "I'm training for a marathon and run daily. I wake up early and go to bed early. I'm organized, tidy, and prefer a drama-free living situation.",
  "I work in a bar so I come home late most nights. I'm quiet when I come in and sleep in most mornings. I'm sociable but respect others' space.",
  "I love entertaining and hosting small gatherings. I always clean up afterward and give roommates notice. I'm considerate and communicate well.",
  "I'm a bookworm who enjoys quiet evenings reading. I'm introverted but friendly, and appreciate a peaceful home environment with mature roommates.",
  "I'm a therapist who works from home and needs a quiet environment during session hours. Confidentiality is important, so I need understanding roommates.",
  "I bring my work stress home sometimes and need time to decompress. I value clear communication and setting boundaries. I'm clean and organized.",
  "I'm a foodie who loves trying new restaurants and cooking exotic cuisines. I'm happy to share meals and introduce roommates to new foods.",
  "I have occasional anxiety and value a calm, predictable living environment. I communicate openly about my needs and am considerate of others.",
  "I'm a dance instructor and sometimes practice routines at home. I can use headphones and be mindful of space, but dancing is part of my daily routine.",
  "I volunteer at an animal shelter and occasionally foster pets for short periods. I would coordinate with roommates before bringing any animals home.",
  "I'm a freelance photographer with equipment that takes up some space. I'm organized and keep my gear contained, but need some storage flexibility.",
  "I use ASL and am part of the Deaf community. I host Deaf friends sometimes and appreciate roommates open to learning about Deaf culture.",
  "I'm an avid gamer who plays online with friends several evenings per week. I use headphones and keep it down after hours.",
  "I have family who visit from overseas occasionally for 1-2 week stays. I would always discuss with roommates well in advance of any visits.",
  "I love DIY projects and crafting. I keep a small workspace for my hobbies but always clean up thoroughly when finished.",
  "I'm in recovery and maintain a sober living environment. I need roommates who respect this and don't bring alcohol or substances into our home.",
  "I practice my religious faith daily with prayer and meditation. I respect all beliefs and ask for the same consideration.",
  "I'm taking online classes in addition to working full-time. I need quiet study time in the evenings and appreciate roommates who respect this.",
  "I follow a structured daily routine and value consistency. I'm organized, plan meals weekly, and prefer roommates with similar habits.",
  "I'm an artist who needs space for painting. I can contain my supplies and work in my room, but some projects may need temporary space in common areas.",
  "I have a service dog who assists with my disability. He's well-trained and doesn't make noise. He needs to be with me at all times.",
  "I use a wheelchair and need an accessible living environment. I'm independent but occasionally may need minor assistance."
];

// Function to generate a random test user
function generateTestUser(index: number, existingCount: number = 0): any {
  const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  const name = `${firstName} ${lastName}`;
  // Add existing count to index to ensure unique emails
  const userIndex = existingCount + index;
  const email = `test${userIndex}@example.com`;
  
  // Random gender with 50% probability
  const gender = Math.random() < 0.5 ? "Male" : "Female";
  
  // Higher chance (90%) of allowing different gender roommates to increase compatibility
  const roomWithDifferentGender = Math.random() < 0.9;
  
  // Select housing region with 80% chance of Bay Area to increase compatibility
  const regions = Object.keys(HOUSING_REGIONS);
  const housingRegion = Math.random() < 0.8 
    ? "Bay Area"  // 80% chance of Bay Area
    : regions[Math.floor(Math.random() * regions.length)];
  
  // Select 1-3 random cities from the region
  const availableCities = HOUSING_REGIONS[housingRegion as keyof typeof HOUSING_REGIONS];
  const numCities = Math.floor(Math.random() * 3) + 1;
  const housingCities = [];
  
  // Handle 'Other' region case
  if (availableCities.length === 0) {
    housingCities.push("Other City");
  } else {
    // Always include San Francisco if in Bay Area to increase city overlap
    if (housingRegion === "Bay Area") {
      housingCities.push("San Francisco");
      if (numCities > 1) {
        const otherCities = availableCities.filter(city => city !== "San Francisco");
        const shuffledCities = [...otherCities].sort(() => 0.5 - Math.random());
        for (let i = 0; i < Math.min(numCities - 1, shuffledCities.length); i++) {
          housingCities.push(shuffledCities[i]);
        }
      }
    } else {
      const shuffledCities = [...availableCities].sort(() => 0.5 - Math.random());
      for (let i = 0; i < Math.min(numCities, shuffledCities.length); i++) {
        housingCities.push(shuffledCities[i]);
      }
    }
  }
  
  // Generate similar internship dates to increase overlap 
  const now = new Date();
  const year = now.getFullYear();
  
  // Use a base start date for all users, with small variations
  const baseStartDate = new Date();
  baseStartDate.setDate(baseStartDate.getDate() + 7); // One week from now
  
  // Each user's start date varies by at most 2 weeks from the base
  const startDate = new Date(baseStartDate);
  startDate.setDate(startDate.getDate() + Math.floor(Math.random() * 14)); 
  
  // More consistent internship duration (10-12 weeks) for higher overlap
  const internshipWeeks = 10 + Math.floor(Math.random() * 2);
  const internshipDays = internshipWeeks * 7;
  
  // End date based on internship duration
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + internshipDays);
  
  const internshipStartDate = startDate.toISOString().split('T')[0]; // YYYY-MM-DD
  const internshipEndDate = endDate.toISOString().split('T')[0]; // YYYY-MM-DD
  
  // Random roommate preference - avoid extreme differences
  const desiredRoommates = ["1", "2", "2", "3"][Math.floor(Math.random() * 4)]; // Bias toward 2
  
  // More consistent budget ranges with good overlap
  const baseBudget = 2000;  // Base budget for all users
  const minBudget = baseBudget - 300 + Math.floor(Math.random() * 600); // 1700-2300
  const maxBudget = minBudget + 500 + Math.floor(Math.random() * 500); // 500-1000 above min
  
  // Generate preferences with some variety
  let preferences: Preference[];
  
  // 20% chance of having neutral preferences
  if (Math.random() < 0.2) {
    preferences = generateNeutralPreferences();
  } else {
    // Generate a mix of preferences
    const defaultStrength: PreferenceStrength = getRandomPreferenceStrength();
    
    // Select 1-3 items to have a specific different preference
    const numSpecificPrefs = Math.floor(Math.random() * 3) + 1;
    const specificItems = [];
    const shuffledPrefs = [...NON_NEGOTIABLES].sort(() => 0.5 - Math.random());
    
    for (let i = 0; i < numSpecificPrefs; i++) {
      specificItems.push(shuffledPrefs[i]);
    }
    
    // Select a different strength for these specific items
    let specificStrength: PreferenceStrength;
    do {
      specificStrength = getRandomPreferenceStrength();
    } while (specificStrength === defaultStrength);
    
    // Avoid too many deal breakers and must haves to reduce preference conflicts
    preferences = generatePreferences(
      defaultStrength === "deal breaker" ? "prefer not" : defaultStrength, 
      specificItems, 
      specificStrength === "deal breaker" ? "prefer not" : specificStrength
    );
  }
  
  // Select a random detailed additional note
  const additionalNotes = ADDITIONAL_NOTES[Math.floor(Math.random() * ADDITIONAL_NOTES.length)];
  
  return {
    name,
    email,
    gender,
    roomWithDifferentGender,
    housingRegion,
    housingCities,
    internshipStartDate,
    internshipEndDate,
    desiredRoommates,
    minBudget,
    maxBudget,
    preferences,
    additionalNotes,
    currentPage: 5,
    isDraft: false,
    isSubmitted: true,
    userEmail: email,  // Store email in both fields for compatibility
    firstName,  // Store first name separately for search
    lastName,  // Store last name separately for search
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

function getRandomPreferenceStrength(): PreferenceStrength {
  const strengths: PreferenceStrength[] = ["deal breaker", "prefer not", "neutral", "prefer", "must have"];
  return strengths[Math.floor(Math.random() * strengths.length)];
}

function generateNeutralPreferences(): Preference[] {
  return NON_NEGOTIABLES.map(item => ({
    item,
    strength: "neutral" as PreferenceStrength
  }));
}

function generatePreferences(
  defaultStrength: PreferenceStrength, 
  specificItems: string[] = [], 
  specificStrength: PreferenceStrength = "must have"
): Preference[] {
  return NON_NEGOTIABLES.map(item => ({
    item,
    strength: specificItems.includes(item) ? specificStrength : defaultStrength
  }));
}

export async function POST(req: NextRequest) {
  // Check if test endpoint is enabled
  if (!ENABLE_TEST_ENDPOINT) {
    return NextResponse.json(
      { error: 'Test endpoints are disabled in production' },
      { status: 403 }
    );
  }
  
  try {
    const session = await getServerSession();
    
    // Only allow authenticated users to create test users
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!ALLOWED_TESTING_EMAILS.includes(session.user.email)) {
      return NextResponse.json(
        { error: 'Access denied - insufficient permissions' },
        { status: 403 }
      );
    }
    
    // Parse request body
    const body = await req.json();
    const { count = 10 } = body;
    
    // Limit count to a reasonable number
    const userCount = Math.min(Math.max(1, count), 50);
    
    // Count existing test users in Firestore using admin SDK
    const testSurveysCollection = adminDb.collection('test_surveys');
    const existingSnapshot = await testSurveysCollection.get();
    const existingCount = existingSnapshot.size;
    
    // Generate and save test users
    const newUsers = [];
    const addedUsers = [];
    
    for (let i = 0; i < userCount; i++) {
      const testUser = generateTestUser(i, existingCount);
      newUsers.push(testUser);
      
      // In Firestore, we'll use the email as the document ID
      const email = testUser.email;
      
      try {
        // Add to test_surveys collection using admin SDK
        await testSurveysCollection.doc(email).set(testUser);
        addedUsers.push(testUser);
      } catch (error) {
        console.error(`Error adding test user ${email}:`, error);
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Added ${addedUsers.length} test users (${userCount} requested)`,
      count: addedUsers.length,
      users: addedUsers.map(user => ({
        name: user.name,
        email: user.email,
        gender: user.gender,
        region: user.housingRegion
      }))
    });
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to create test users',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 